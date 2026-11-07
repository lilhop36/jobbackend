// JobHunter Ethiopia — Ethiopian Reporter Jobs adapter
// Classification: PUBLIC_FEED. RSS feed for discovery hints + polite HTML extraction.
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { BaseJobSourceAdapter } from './base.js';
import { JobPage, RawJobListing, SearchQuery } from '../types/index.js';

export class ReporterJobsAdapter extends BaseJobSourceAdapter {
  readonly id = 'reporterjobs';
  readonly name = 'Ethiopian Reporter Jobs';
  readonly type = 'PUBLIC_FEED' as const;
  readonly baseUrl = 'https://www.ethiopianreporterjobs.com';

  private xml = new XMLParser({ ignoreAttributes: false, trimValues: true });

  async searchJobs(query: SearchQuery): Promise<JobPage> {
    const rss = await this.politeGet(`${this.baseUrl}/feed/`, { responseType: 'text' });
    const parsed = this.xml.parse(rss.data);
    const channel = parsed?.rss?.channel ?? {};
    const items = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];

    let listings = items
      .map((it: any) => this.itemToListing(it))
      .filter((l: RawJobListing) => /\/jobs\/\d+/.test(l.url) || /job|vacancy|position/i.test(l.title));

    // WordPress search endpoint for keyword queries
    if (query.q) {
      try {
        const page = await this.politeGet(this.baseUrl, {
          params: { s: query.q },
          responseType: 'text',
        });
        const extra = this.parseSearchResults(page.data);
        const seen = new Set(listings.map((l: RawJobListing) => l.url));
        for (const e of extra) if (!seen.has(e.url)) listings.push(e);
      } catch (err) {
        this.reportSourceError(err as Error);
      }
    }

    return { jobs: listings, hasMore: false };
  }

  async getJobDetails(sourceJobId: string): Promise<RawJobListing> {
    const res = await this.politeGet(`${this.baseUrl}/jobs/${sourceJobId}/`, { responseType: 'text' });
    const $ = cheerio.load(res.data);
    const title = $('h1.entry-title, h1').first().text().trim() || 'Untitled';
    $('.entry-content p, .entry-content br, .entry-content div, .entry-content li, article p, article br').after('\n');
    const plain = $('.entry-content, article').first().text().replace(/\n{2,}/g, '\n').trim();
    const emails = Array.from(new Set(plain.match(/[\w.-]+@[\w.-]+\.\w{2,}/g) ?? []));
    const phones = Array.from(new Set(plain.match(/(?:\+251|09|07)\d{7,9}/g) ?? []));
    return {
      sourceJobId,
      url: `${this.baseUrl}/jobs/${sourceJobId}/`,
      title,
      descriptionPlain: plain,
      locationRaw: plain.match(/(?:location|place of work)\s*:\s*([^\n,]{2,50})/i)?.[1]?.trim() || 'Ethiopia',
      salaryRaw: plain.match(/(?:salary|monthly salary)\s*:\s*([^.\n]{2,40})/i)?.[1]?.trim(),
      applicationMethod: emails.length ? 'EMAIL' : phones.length ? 'PHONE' : 'IN_PERSON',
      applicationInstructions: `Apply via: ${emails.concat(phones).join(', ') || 'see full listing'}`,
      sourceAttribution: this.name,
    };
  }

  async fetchNextPage(_cursor?: string): Promise<JobPage> {
    return this.searchJobs({});
  }

  private itemToListing(it: any): RawJobListing {
    const plain = cheerio.load(it.description || '').text().trim();
    const id = it.link ? it.link.match(/\/jobs\/(\d+)\/?/)?.[1] : undefined;
    return {
      sourceJobId: id,
      url: it.link || this.baseUrl,
      title: (it.title || 'Untitled').replace(/&#8211;|&#8212;/g, '-'),
      descriptionPlain: plain,
      locationRaw: 'Ethiopia',
      publishedAt: it.pubDate ? new Date(it.pubDate) : undefined,
      sourceAttribution: this.name,
    };
  }

  private parseSearchResults(html: string): RawJobListing[] {
    const $ = cheerio.load(html);
    const listings: RawJobListing[] = [];
    $('a[href*="/jobs/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const m = href.match(/\/jobs\/(\d+)\/?/);
      if (!m) return;
      const title = $(el).text().trim();
      if (!title || title.length < 3) return;
      listings.push({
        sourceJobId: m[1],
        url: href,
        title,
        locationRaw: 'Ethiopia',
        sourceAttribution: this.name,
      });
    });
    return listings;
  }
}
