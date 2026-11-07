// JobHunter Ethiopia — Ethiojobs adapter
// Classification: PERMITTED_HTML. Sitemap-led discovery + polite HTML/JSON-LD parsing.
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { BaseJobSourceAdapter } from './base.js';
import { JobPage, RawJobListing, SearchQuery } from '../types/index.js';

export class EthiojobsAdapter extends BaseJobSourceAdapter {
  readonly id = 'ethiojobs';
  readonly name = 'Ethiojobs';
  readonly type = 'PERMITTED_HTML' as const;
  readonly baseUrl = 'https://ethiojobs.net';

  protected minIntervalMs = 2000; // conservative ~0.5 req/s
  private xml = new XMLParser({ ignoreAttributes: false, trimValues: true });

  async searchJobs(query: SearchQuery): Promise<JobPage> {
    const sitemap = await this.politeGet(`${this.baseUrl}/sitemap-jobs.xml`, { responseType: 'text' });
    const parsed = this.xml.parse(sitemap.data);
    const urls: Array<{ loc?: string }> = parsed?.urlset?.url ?? [];
    const urlList = (Array.isArray(urls) ? urls : [urls]).map((u) => u.loc).filter(Boolean) as string[];

    const limit = Math.min(query.limit ?? 20, 40);
    const slice = urlList.slice(0, limit);

    const listings: RawJobListing[] = [];
    for (const url of slice) {
      try {
        const slug = url.replace(/^.*\/job\//, '').replace(/\/$/, '');
        const listing = await this.getJobDetails(slug);
        listings.push(listing);
      } catch (err) {
        this.reportSourceError(err as Error);
      }
    }

    let result = listings;
    if (query.q) {
      const q = query.q.toLowerCase();
      result = result.filter((l) => (l.title + ' ' + (l.descriptionPlain || '') + ' ' + (l.employer || '')).toLowerCase().includes(q));
    }
    return { jobs: result, nextCursor: String(limit), hasMore: urlList.length > limit };
  }

  async getJobDetails(slugOrId: string): Promise<RawJobListing> {
    const url = slugOrId.startsWith('http') ? slugOrId : `${this.baseUrl}/job/${slugOrId}`;
    const res = await this.politeGet(url, { responseType: 'text' });
    const $ = cheerio.load(res.data);

    // JSON-LD JobPosting metadata extraction
    let jsonLd: any = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || '{}');
        if (parsed['@type'] === 'JobPosting' || parsed['@type']?.includes?.('JobPosting')) jsonLd = parsed;
      } catch {
        /* ignore invalid JSON-LD */
      }
    });

    const title = jsonLd?.title || $('h1').first().text().trim() || 'Untitled';
    const employer = jsonLd?.hiringOrganization?.name || $('.company-name').first().text().trim() || 'Ethiojobs Employer';
    const desc = jsonLd?.description || $('.job-description, article').first().text().trim();
    const loc = jsonLd?.jobLocation?.address?.addressLocality || $('.job-location').first().text().trim() || 'Ethiopia';
    const deadline = jsonLd?.validThrough ? new Date(jsonLd.validThrough) : undefined;
    const published = jsonLd?.datePosted ? new Date(jsonLd.datePosted) : undefined;

    return {
      sourceJobId: slugOrId.replace(/^.*\/job\//, '').replace(/\/$/, ''),
      url,
      title,
      employer,
      descriptionPlain: cheerio.load(desc || '').text().trim(),
      locationRaw: loc,
      employmentType: jsonLd?.employmentType,
      educationLevel: jsonLd?.educationRequirements,
      publishedAt: published,
      deadline,
      applicationUrl: url,
      sourceAttribution: this.name,
    };
  }

  async fetchNextPage(cursor?: string): Promise<JobPage> {
    const start = Number(cursor || 0);
    const sitemap = await this.politeGet(`${this.baseUrl}/sitemap-jobs.xml`, { responseType: 'text' });
    const parsed = this.xml.parse(sitemap.data);
    const urls: Array<{ loc?: string }> = parsed?.urlset?.url ?? [];
    const urlList = (Array.isArray(urls) ? urls : [urls]).map((u) => u.loc).filter(Boolean) as string[];
    const slice = urlList.slice(start, start + 20);
    const listings: RawJobListing[] = [];
    for (const u of slice) {
      try {
        listings.push(await this.getJobDetails(u));
      } catch (err) {
        this.reportSourceError(err as Error);
      }
    }
    return { jobs: listings, nextCursor: String(start + 20), hasMore: urlList.length > start + 20 };
  }
}
