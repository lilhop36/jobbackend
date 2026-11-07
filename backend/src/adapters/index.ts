// JobHunter Ethiopia — Central Adapter Registry (Section 5)
// Tracks health, error budgets, rate limiting, and lastSync times per source.
// One failing source never stops the entire aggregator.
import { JobSourceAdapter, SourceHealth, SourceType } from '../types/index.js';
import { prisma } from '../db/prisma.js';
import { EthioNgoJobsAdapter } from './ethioNgoJobsAdapter.js';
import { ReliefWebAdapter } from './reliefWebAdapter.js';
import { WhoStellisAdapter } from './whoStellisAdapter.js';
import { ReporterJobsAdapter } from './reporterJobsAdapter.js';
import { EthiojobsAdapter } from './ethiojobsAdapter.js';
import { ExternalSearchAdapter } from './externalSearchAdapter.js';

export const EXTERNAL_SOURCES = [
  new ExternalSearchAdapter({
    id: 'pscams',
    name: 'PSCAMS (Federal Civil Service Commission)',
    baseUrl: 'https://pscams.ecsc.gov.et',
    searchUrlTemplate: 'https://www.google.com/search?q={query}',
    queryPrefix: 'site:pscams.ecsc.gov.et jobs ',
    unintegratedReason: 'No public vacancy API/RSS; candidate actions require login. Deep link only.',
  }),
  new ExternalSearchAdapter({
    id: 'addis_zemen',
    name: 'Addis Zemen / EPA',
    baseUrl: 'https://www.press.et',
    searchUrlTemplate: 'https://www.press.et/?s={query}',
    queryPrefix: '',
    unintegratedReason: 'Hybrid newspaper/e-paper; official site error-prone. Manual import + OCR pipeline recommended.',
  }),
  new ExternalSearchAdapter({
    id: 'cbe_careers',
    name: 'Commercial Bank of Ethiopia',
    baseUrl: 'https://combanketh.et/cbeapi/vacancy/',
    searchUrlTemplate: 'https://www.google.com/search?q={query}',
    queryPrefix: 'site:combanketh.et vacancy ',
    unintegratedReason: 'Official vacancy PDFs and separate portal vacancy.cbe.com.et; no structured feed.',
  }),
  new ExternalSearchAdapter({
    id: 'ethiopian_airlines',
    name: 'Ethiopian Airlines Careers',
    baseUrl: 'https://jobs.ethiopianairlines.com',
    searchUrlTemplate: 'https://www.google.com/search?q={query}',
    queryPrefix: 'site:jobs.ethiopianairlines.com ',
    unintegratedReason: 'Public vacancies page exists; adapter queued for Wave 3.',
  }),
  new ExternalSearchAdapter({
    id: 'ethio_telecom',
    name: 'Ethio Telecom',
    baseUrl: 'https://www.ethiotelecom.et',
    searchUrlTemplate: 'https://www.ethiotelecom.et/?s={query}',
    queryPrefix: '',
    unintegratedReason: 'Official vacancy entry point exists; eCare shell public structure not yet mapped.',
  }),
  new ExternalSearchAdapter({
    id: 'hahujobs',
    name: 'HaHuJobs',
    baseUrl: 'https://www.hahu.jobs',
    searchUrlTemplate: 'https://www.hahu.jobs/jobs',
    queryPrefix: '',
    unintegratedReason: 'Client-rendered JS; sitemap-led adapter queued for Wave 2; exploring partner API.',
  }),
  new ExternalSearchAdapter({
    id: 'geezjobs',
    name: 'GeezJobs',
    baseUrl: 'https://geezjobs.com',
    searchUrlTemplate: 'https://geezjobs.com/search-jobs',
    queryPrefix: '',
    unintegratedReason: 'Direct curl receives 403; browser-grade adapter queued for Wave 2.',
  }),
  new ExternalSearchAdapter({
    id: 'etcareers',
    name: 'Etcareers',
    baseUrl: 'https://etcareers.com',
    searchUrlTemplate: 'https://etcareers.com/jobs',
    queryPrefix: '',
    unintegratedReason: 'Site is live; adapter queued for Wave 2.',
  }),
  new ExternalSearchAdapter({
    id: 'ictjobs_ethiopia',
    name: 'ICT Jobs Ethiopia',
    baseUrl: 'https://ictjobs.et',
    searchUrlTemplate: 'https://www.google.com/search?q={query}',
    queryPrefix: 'site:ictjobs.et/jobs ',
    unintegratedReason: 'Public HTML + sitemaps; adapter queued for Wave 2.',
  }),
];

class AdapterRegistry {
  private adapters = new Map<string, JobSourceAdapter>();

  constructor() {
    this.register(new EthioNgoJobsAdapter());
    this.register(new ReliefWebAdapter());
    this.register(new WhoStellisAdapter());
    this.register(new ReporterJobsAdapter());
    this.register(new EthiojobsAdapter());
    for (const s of EXTERNAL_SOURCES) this.register(s);
  }

  register(a: JobSourceAdapter): void {
    this.adapters.set(a.id, a);
  }

  get(id: string): JobSourceAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): JobSourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  enabled(): JobSourceAdapter[] {
    return this.list(); // enable/disable state is enriched from DB in getSourceHealth
  }

  async healthAll(): Promise<SourceHealth[]> {
    return Promise.all(this.list().map((a) => a.getSourceHealth()));
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await prisma.source.upsert({
      where: { id },
      update: { enabled },
      create: {
        id,
        name: this.adapters.get(id)?.name || id,
        type: (this.adapters.get(id)?.type || 'EXTERNAL_SEARCH') as SourceType,
        baseUrl: this.adapters.get(id)?.baseUrl || '',
        enabled,
      },
    });
  }
}

export const registry = new AdapterRegistry();
export default registry;
