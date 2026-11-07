// JobHunter Ethiopia — External search fallback adapter
// Per Section 5 & 18: when a source cannot be integrated, document the reason
// and provide an external search alternative.
import { BaseJobSourceAdapter } from './base.js';
import { JobPage, RawJobListing, SearchQuery, SourceType } from '../types/index.js';

export interface ExternalSearchSourceConfig {
  id: string;
  name: string;
  baseUrl: string;
  searchUrlTemplate: string; // e.g. "https://example.com/?s={query}" or "https://www.google.com/search?q={query}"
  queryPrefix?: string;     // e.g. "site:pscams.ecsc.gov.et "
  unintegratedReason: string;
}

export class ExternalSearchAdapter extends BaseJobSourceAdapter {
  readonly type: SourceType = 'EXTERNAL_SEARCH';
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly searchUrlTemplate: string;
  readonly queryPrefix: string;
  readonly unintegratedReason: string;

  constructor(cfg: ExternalSearchSourceConfig) {
    super();
    this.id = cfg.id;
    this.name = cfg.name;
    this.baseUrl = cfg.baseUrl;
    this.searchUrlTemplate = cfg.searchUrlTemplate;
    this.queryPrefix = cfg.queryPrefix || '';
    this.unintegratedReason = cfg.unintegratedReason;
  }

  buildSearchUrl(q: string): string {
    const full = encodeURIComponent((this.queryPrefix + q).trim());
    return this.searchUrlTemplate.replace('{query}', full);
  }

  async searchJobs(query: SearchQuery): Promise<JobPage> {
    const url = this.buildSearchUrl(query.q || 'jobs');
    const fakeLead: RawJobListing = {
      sourceJobId: 'external_search_lead',
      url,
      title: `Search ${this.name}`,
      employer: this.name,
      descriptionPlain: this.unintegratedReason,
      locationRaw: 'Ethiopia',
      applicationUrl: url,
      sourceAttribution: this.name,
    };
    return { jobs: [fakeLead], hasMore: false };
  }

  async getJobDetails(_id: string): Promise<RawJobListing> {
    return (await this.searchJobs({})).jobs[0];
  }

  async fetchNextPage(): Promise<JobPage> {
    return this.searchJobs({});
  }
}
