// JobHunter Ethiopia — ReliefWeb v2 official JSON API adapter
// Classification: OFFICIAL_API. Requires a registered appname.
import { BaseJobSourceAdapter } from './base.js';
import { JobPage, RawJobListing, SearchQuery } from '../types/index.js';

interface RwJob {
  id: string;
  fields: {
    title: string;
    url: string;
    body?: string;
    description?: string;
    date?: { created?: string; closing?: string };
    source?: Array<{ name: string; homepage?: string }>;
    country?: Array<{ name: string; iso3: string }>;
    city?: Array<{ name: string }>;
    career_categories?: Array<{ name: string }>;
    theme?: Array<{ name: string }>;
    experience_level?: Array<{ name: string }>;
    how_to_apply?: string;
  };
}

export class ReliefWebAdapter extends BaseJobSourceAdapter {
  readonly id = 'reliefweb';
  readonly name = 'ReliefWeb (UN OCHA)';
  readonly type = 'OFFICIAL_API' as const;
  readonly baseUrl = 'https://api.reliefweb.int/v2';

  private appname: string;

  constructor(appname = process.env.RELIEFWEB_APPNAME || 'jobhunter-ethiopia') {
    super();
    this.appname = appname;
  }

  async searchJobs(query: SearchQuery): Promise<JobPage> {
    const limit = Math.min(query.limit ?? 50, 100);
    const params: Record<string, unknown> = {
      appname: this.appname,
      'filter[field]': 'country.iso3',
      'filter[value]': 'ETH',
      limit,
      sort: ['date.created:desc'],
      fields: {
        include: [
          'title',
          'url',
          'body',
          'date',
          'source',
          'country',
          'city',
          'career_categories',
          'experience_level',
          'how_to_apply',
        ],
      },
    };
    if (query.q) {
      params['query[value]'] = query.q;
    }

    try {
      const res = await this.politeGet(`${this.baseUrl}/jobs`, { params });
      const data = res.data;
      const jobs: RawJobListing[] = (data?.data ?? []).map((it: RwJob) => this.rwToListing(it));
      return { jobs, hasMore: (data?.data?.length ?? 0) === limit };
    } catch (err: any) {
      // 403 usually means appname not yet approved — report honestly
      this.reportSourceError(err as Error);
      return { jobs: [], hasMore: false };
    }
  }

  async getJobDetails(sourceJobId: string): Promise<RawJobListing> {
    const res = await this.politeGet(`${this.baseUrl}/jobs/${sourceJobId}`, {
      params: { appname: this.appname },
    });
    return this.rwToListing(res.data?.data?.[0]);
  }

  async fetchNextPage(_cursor?: string): Promise<JobPage> {
    return this.searchJobs({});
  }

  private rwToListing(it: RwJob): RawJobListing {
    const f = it?.fields ?? ({} as RwJob['fields']);
    const employer = f.source?.[0]?.name || 'Humanitarian Employer';
    const city = f.city?.[0]?.name;
    const country = f.country?.[0]?.name || 'Ethiopia';
    const loc = [city, country].filter(Boolean).join(', ');
    const desc = f.body || f.description || '';
    const plain = desc.replace(/<[^>]+>/g, '').trim();
    const skills = (f.career_categories ?? []).map((c) => c.name);
    return {
      sourceJobId: String(it.id),
      url: f.url || `https://reliefweb.int/job/${it.id}`,
      title: f.title || 'Untitled',
      employer,
      employerWebsite: f.source?.[0]?.homepage,
      description: desc,
      descriptionPlain: plain,
      sector: 'NGO & Humanitarian',
      skills,
      locationRaw: loc || 'Ethiopia',
      experienceLevel: f.experience_level?.[0]?.name,
      publishedAt: f.date?.created ? new Date(f.date.created) : undefined,
      deadline: f.date?.closing ? new Date(f.date.closing) : undefined,
      applicationInstructions: f.how_to_apply,
      sourceAttribution: this.name,
    };
  }
}
