// JobHunter Ethiopia — EthioNGOJobs adapter
// Classification: PUBLIC_FEED. RSS feed + WordPress REST API enrichment.
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { BaseJobSourceAdapter } from './base.js';
import { JobPage, RawJobListing, SearchQuery } from '../types/index.js';

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  'content:encoded'?: string;
  category?: string | string[];
}

export class EthioNgoJobsAdapter extends BaseJobSourceAdapter {
  readonly id = 'ethiongojobs';
  readonly name = 'EthioNGOJobs';
  readonly type = 'PUBLIC_FEED' as const;
  readonly baseUrl = 'https://www.ethiongojobs.com';

  private xml = new XMLParser({ ignoreAttributes: false, trimValues: true });

  async searchJobs(query: SearchQuery): Promise<JobPage> {
    const rss = await this.politeGet(`${this.baseUrl}/feed/`, { responseType: 'text' });
    const parsed = this.xml.parse(rss.data);
    const channel = parsed?.rss?.channel ?? {};
    const items: RssItem[] = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];

    let listings = items.map((it) => this.itemToListing(it));

    // Optional WordPress REST enrichment for search/backfill
    if (query.q) {
      try {
        const rest = await this.politeGet(`${this.baseUrl}/wp-json/wp/v2/posts`, {
          params: { search: query.q, per_page: 20 },
        });
        if (Array.isArray(rest.data)) {
          const restListings = rest.data.map((p: any) => this.postToListing(p));
          listings = this.mergeUnique([...listings, ...restListings]);
        }
      } catch (err) {
        this.reportSourceError(err as Error);
      }
    }

    if (query.q) {
      const q = query.q.toLowerCase();
      listings = listings.filter((l) => (l.title + ' ' + (l.description || '')).toLowerCase().includes(q));
    }

    return { jobs: listings, hasMore: false };
  }

  async getJobDetails(sourceJobId: string): Promise<RawJobListing> {
    const res = await this.politeGet(`${this.baseUrl}/wp-json/wp/v2/posts/${sourceJobId}`);
    return this.postToListing(res.data);
  }

  async fetchNextPage(_cursor?: string): Promise<JobPage> {
    return this.searchJobs({});
  }

  private itemToListing(it: RssItem): RawJobListing {
    const html = (it['content:encoded'] || it.description || '') as string;
    const { plain, employer, deadline, applyUrl } = this.extractDetails(html);
    const cats = it.category ? (Array.isArray(it.category) ? it.category : [it.category]) : [];
    return {
      sourceJobId: it.link ? it.link.replace(/^.*\/([^/]+)\/?$/, '$1') : undefined,
      url: it.link || this.baseUrl,
      title: it.title || 'Untitled',
      employer: employer || 'NGO Employer',
      descriptionPlain: plain,
      sector: 'NGO & Humanitarian',
      skills: cats,
      locationRaw: this.extractLocation(plain) || 'Ethiopia',
      publishedAt: it.pubDate ? new Date(it.pubDate) : undefined,
      deadline,
      applicationUrl: applyUrl,
      applicationMethod: applyUrl ? 'URL' : undefined,
      sourceAttribution: this.name,
    };
  }

  private postToListing(p: any): RawJobListing {
    const plain = cheerio.load(p.content?.rendered || '').text().trim();
    const { deadline, employer, applyUrl } = this.extractDetails(p.content?.rendered || '');
    return {
      sourceJobId: String(p.id),
      url: p.link || `${this.baseUrl}/?p=${p.id}`,
      title: cheerio.load(p.title?.rendered || '').text() || 'Untitled',
      employer: employer || 'NGO Employer',
      description: p.content?.rendered,
      descriptionPlain: plain,
      sector: 'NGO & Humanitarian',
      locationRaw: this.extractLocation(plain) || 'Ethiopia',
      publishedAt: p.date ? new Date(p.date) : undefined,
      deadline,
      applicationUrl: applyUrl,
      applicationMethod: applyUrl ? 'URL' : undefined,
      sourceAttribution: this.name,
    };
  }

  private extractDetails(html: string): { plain: string; employer?: string; deadline?: Date; applyUrl?: string } {
    const $ = cheerio.load(html);
    $('p, br, div, li, h1, h2, h3, h4, tr, td').after('\n');
    const plain = $.text().replace(/\n{2,}/g, '\n').trim();

    // employer heuristics
    let employer: string | undefined;
    const empMatch = plain.match(/(?:employer|organization|company|org\.)\s*:\s*([^\n,]{2,80})/i);
    if (empMatch) employer = empMatch[1].trim();

    // deadline heuristics
    let deadline: Date | undefined;
    const deadMatch = plain.match(/(?:deadline|closing date)\s*:\s*([A-Za-z0-9,\- ]{6,30})/i);
    if (deadMatch) {
      const d = new Date(deadMatch[1].trim());
      if (!isNaN(d.getTime())) deadline = d;
    }

    // application link
    let applyUrl: string | undefined;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase();
      if (/apply|submit|application|careers/i.test(text) && /^https?:\/\//i.test(href)) {
        applyUrl = href;
        return false;
      }
    });

    return { plain, employer, deadline, applyUrl };
  }

  private extractLocation(plain: string): string | undefined {
    const m = plain.match(/(?:location|place of work|duty station)\s*:\s*([^\n,]{2,60})/i);
    return m ? m[1].trim() : undefined;
  }

  private mergeUnique(listings: RawJobListing[]): RawJobListing[] {
    const seen = new Set<string>();
    return listings.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)));
  }
}
