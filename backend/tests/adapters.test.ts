import { describe, it, expect, vi } from 'vitest';
import { EthioNgoJobsAdapter } from '../src/adapters/ethioNgoJobsAdapter.js';
import { ReliefWebAdapter } from '../src/adapters/reliefWebAdapter.js';
import { WhoStellisAdapter } from '../src/adapters/whoStellisAdapter.js';
import { ReporterJobsAdapter } from '../src/adapters/reporterJobsAdapter.js';
import { EthiojobsAdapter } from '../src/adapters/ethiojobsAdapter.js';

function mockAxios(adapter: any, responses: Record<string, any>) {
  adapter.http.get = vi.fn(async (url: string, cfg?: any) => {
    const full = url + ' ' + JSON.stringify(cfg?.params ?? cfg ?? {});
    for (const [key, val] of Object.entries(responses)) if (full.includes(key)) return { data: val };
    return { data: '' };
  });
}

describe('EthioNGOJobs adapter', () => {
  it('parses RSS items and extracts employer/deadline heuristics', async () => {
    const rss = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>Project Officer - Health</title>
        <link>https://www.ethiongojobs.com/project-officer-health-2026/</link>
        <pubDate>Thu, 07 Nov 2026 12:00:00 +0000</pubDate>
        <content:encoded><![CDATA[<p>Employer: Care International Ethiopia</p><p>Deadline: 2026-12-01</p><p>Location: Hawassa</p><p><a href="https://example.workday.com/apply">Apply Now</a></p>]]></content:encoded>
        <category>Health</category>
      </item>
    </channel></rss>`;
    const adapter = new EthioNgoJobsAdapter();
    mockAxios(adapter, { '/feed/': rss });

    const page = await adapter.searchJobs({});
    expect(page.jobs.length).toBe(1);
    const j = adapter.normalizeJob(page.jobs[0]);
    expect(j.title).toBe('Project Officer - Health');
    expect(j.employer).toBe('Care International Ethiopia');
    expect(j.region).toBe('Sidama');
    expect(j.city).toBe('Hawassa');
    expect(j.sector).toBe('NGO & Humanitarian');
    expect(j.applicationUrl).toBe('https://example.workday.com/apply');
    expect(j.deadline).toBeInstanceOf(Date);
  });
});

describe('ReliefWeb adapter', () => {
  it('parses v2 JSON and maps country/city/source fields', async () => {
    const fixture = {
      data: [
        {
          id: '1234567',
          fields: {
            title: 'WASH Specialist',
            url: 'https://reliefweb.int/job/1234567',
            source: [{ name: 'UNICEF', homepage: 'https://www.unicef.org' }],
            country: [{ name: 'Ethiopia', iso3: 'ETH' }],
            city: [{ name: 'Addis Ababa' }],
            career_categories: [{ name: 'Water Sanitation Hygiene' }],
            date: { created: '2026-11-01', closing: '2026-12-15' },
            how_to_apply: 'Apply through UNICEF e-recruitment portal',
          },
        },
      ],
    };
    const adapter = new ReliefWebAdapter();
    mockAxios(adapter, { '/jobs': fixture });

    const page = await adapter.searchJobs({});
    expect(page.jobs.length).toBe(1);
    const j = adapter.normalizeJob(page.jobs[0]);
    expect(j.title).toBe('WASH Specialist');
    expect(j.employer).toBe('UNICEF');
    expect(j.region).toBe('Addis Ababa');
    expect(j.applicationInstructions).toMatch(/e-recruitment/);
    expect(j.deadline).toBeInstanceOf(Date);
  });
});

describe('WHO Stellis adapter', () => {
  it('filters RSS feed down to Ethiopia vacancies only', async () => {
    const rss = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Technical Officer - Geneva</title><link>https://careers.who.int/1</link><description>duty station: Geneva, Switzerland</description></item>
      <item><title>NPO (Health Emergencies) - Ethiopia</title><link>https://careers.who.int/2</link><description>duty station: Addis Ababa, Ethiopia</description></item>
    </channel></rss>`;
    const adapter = new WhoStellisAdapter();
    mockAxios(adapter, { RSS_WHO_VACANCIES: rss });

    const page = await adapter.searchJobs({});
    expect(page.jobs.length).toBe(1);
    expect(page.jobs[0].title).toMatch(/NPO.*Ethiopia/);
    const j = adapter.normalizeJob(page.jobs[0]);
    expect(j.region).toBe('Addis Ababa');
  });
});

describe('Ethiopian Reporter Jobs adapter', () => {
  it('parses numeric job detail pages with email application methods', async () => {
    const adapter = new ReporterJobsAdapter();
    mockAxios(adapter, {
      '/jobs/138200/':
        '<html><body><h1 class="entry-title">Cashier</h1><article class="entry-content">Salary: 12,000 ETB. Location: Adama. Apply to hr@company.com or 0911000000</article></body></html>',
    });

    const raw = await adapter.getJobDetails('138200');
    expect(raw.title).toBe('Cashier');
    expect(raw.salaryRaw).toBe('12,000 ETB');
    expect(raw.applicationMethod).toBe('EMAIL');
    expect(raw.applicationInstructions).toMatch(/hr@company\.com/);
  });
});

describe('Ethiojobs adapter', () => {
  it('parses sitemap discovery and JSON-LD job detail pages', async () => {
    const sitemap = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://ethiojobs.net/job/frontend-developer-12345/</loc></url>
    </urlset>`;
    const detail = `<html><head>
      <script type="application/ld+json">{"@type":"JobPosting","title":"Frontend Developer","hiringOrganization":{"name":"Minab Tech"},"jobLocation":{"address":{"addressLocality":"Bahir Dar"}},"datePosted":"2026-11-06","validThrough":"2026-12-10","description":"Build web apps"}</script>
    </head><body><h1>Frontend Developer</h1></body></html>`;
    const adapter = new EthiojobsAdapter();
    mockAxios(adapter, { 'sitemap-jobs.xml': sitemap, '/job/': detail });

    const page = await adapter.searchJobs({ limit: 5 });
    expect(page.jobs.length).toBe(1);
    const j = adapter.normalizeJob(page.jobs[0]);
    expect(j.title).toBe('Frontend Developer');
    expect(j.employer).toBe('Minab Tech');
    expect(j.region).toBe('Amhara');
    expect(j.city).toBe('Bahir Dar');
  });
});

describe('adapter contract validation and rate-limit handling', () => {
  it('rejects jobs missing title or invalid URL', () => {
    const adapter = new EthiojobsAdapter();
    const bad = adapter.normalizeJob({ url: 'not-a-url', title: '', locationRaw: 'Addis Ababa' });
    const res = adapter.validateJob(bad);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('title is required');
    expect(res.errors).toContain('originalUrl must be an http(s) URL');
  });

  it('respects Retry-After header on 429', () => {
    const adapter = new EthiojobsAdapter();
    const err = { isAxiosError: true, response: { status: 429, headers: { 'retry-after': '12' } } };
    const rl = adapter.handleRateLimit(err);
    expect(rl.shouldRetry).toBe(true);
    expect(rl.waitMs).toBe(12000);
  });
});
