// JobHunter Ethiopia — WHO Stellis RSS feed adapter
// Classification: PUBLIC_FEED. Official RSS for external candidates & internships.
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { BaseJobSourceAdapter } from './base.js';
import { JobPage, RawJobListing, SearchQuery } from '../types/index.js';

export class WhoStellisAdapter extends BaseJobSourceAdapter {
  readonly id = 'who_stellis';
  readonly name = 'WHO Stellis Careers';
  readonly type = 'PUBLIC_FEED' as const;
  readonly baseUrl = 'https://careers.who.int';

  private xml = new XMLParser({ ignoreAttributes: false, trimValues: true });

  async searchJobs(query: SearchQuery): Promise<JobPage> {
    const res = await this.politeGet(`${this.baseUrl}/stellent/idcplg`, {
      params: {
        IdcService: 'GET_RSS_FEED',
        dDocName: 'RSS_WHO_VACANCIES',
      },
      responseType: 'text',
    });
    const parsed = this.xml.parse(res.data);
    const channel = parsed?.rss?.channel ?? {};
    const items = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];

    let listings: RawJobListing[] = items.map((it: any) => this.itemToListing(it));

    // Filter to Ethiopia vacancies
    listings = listings.filter((l) => (l.locationRaw + ' ' + (l.title || '')).toLowerCase().includes('ethiopia'));

    if (query.q) {
      const q = query.q.toLowerCase();
      listings = listings.filter((l) => (l.title + ' ' + (l.description || '')).toLowerCase().includes(q));
    }
    return { jobs: listings, hasMore: false };
  }

  async getJobDetails(_sourceJobId: string): Promise<RawJobListing> {
    const page = await this.searchJobs({});
    return page.jobs[0] ?? { url: `${this.baseUrl}/career-at-who`, title: 'WHO Vacancy', locationRaw: 'Ethiopia', sourceAttribution: this.name };
  }

  async fetchNextPage(_cursor?: string): Promise<JobPage> {
    return this.searchJobs({});
  }

  private itemToListing(it: any): RawJobListing {
    const plain = cheerio.load(it.description || '').text().trim();
    return {
      sourceJobId: it.guid ? String(it.guid['#text'] ?? it.guid) : undefined,
      url: it.link || this.baseUrl,
      title: it.title || 'WHO Vacancy',
      employer: 'World Health Organization (WHO)',
      descriptionPlain: plain,
      sector: 'Health & Medical',
      locationRaw: plain.match(/duty station[^:\n]*:\s*([^\n,]{2,50})/i)?.[1]?.trim() || 'Ethiopia',
      publishedAt: it.pubDate ? new Date(it.pubDate) : undefined,
      sourceAttribution: this.name,
    };
  }
}
