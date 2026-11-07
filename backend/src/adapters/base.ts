// JobHunter Ethiopia — Base adapter implementing the common JobSourceAdapter contract
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  JobSourceAdapter,
  SourceType,
  SearchQuery,
  JobPage,
  RawJobListing,
  NormalizedJob,
  ValidationResult,
  SourceHealth,
} from '../types/index.js';
import { prisma } from '../db/prisma.js';
import { normalizeJob as sharedNormalize } from '../normalizer/jobNormalizer.js';

export abstract class BaseJobSourceAdapter implements JobSourceAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly type: SourceType;
  abstract readonly baseUrl: string;

  protected http: AxiosInstance;
  protected consecutiveFailures = 0;
  protected lastError?: string;
  protected lastSyncAt: Date | null = null;
  protected minIntervalMs = 1500; // polite default: ~1.5s between requests
  protected lastRequestTime = 0;
  protected userAgent =
    'JobHunterEthiopiaBot/1.0 (+https://github.com/manus-ai/jobhunter-ethiopia; job aggregator, respects robots.txt)';

  constructor() {
    this.http = axios.create({
      timeout: 20000,
      headers: {
        'User-Agent': this.userAgent,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,am;q=0.8',
      },
      maxRedirects: 5,
      validateStatus: (s) => (s >= 200 && s < 300) || s === 404,
    });
  }

  abstract searchJobs(query: SearchQuery): Promise<JobPage>;
  abstract getJobDetails(sourceJobId: string): Promise<RawJobListing>;
  abstract fetchNextPage(cursor?: string): Promise<JobPage>;

  normalizeJob(raw: RawJobListing): NormalizedJob {
    return sharedNormalize(raw, this.id, this.name);
  }

  validateJob(job: NormalizedJob): ValidationResult {
    const errors: string[] = [];
    if (!job.title || job.title.trim().length === 0) errors.push('title is required');
    if (!job.originalUrl || !job.originalUrl.startsWith('http')) errors.push('originalUrl must be an http(s) URL');
    if (!job.sourceAttribution) errors.push('sourceAttribution is required');
    if (job.salaryMin !== undefined && job.salaryMin < 0) errors.push('salaryMin cannot be negative');
    if (job.salaryMin !== undefined && job.salaryMax !== undefined && job.salaryMin > job.salaryMax) {
      errors.push('salaryMin cannot exceed salaryMax');
    }
    return { valid: errors.length === 0, errors };
  }

  async getSourceHealth(): Promise<SourceHealth> {
    const rec = await prisma.source.findUnique({ where: { id: this.id } }).catch(() => null);
    return {
      sourceId: this.id,
      sourceName: this.name,
      sourceType: this.type,
      enabled: rec?.enabled ?? true,
      ok: this.consecutiveFailures === 0,
      consecutiveFailures: this.consecutiveFailures,
      lastSyncAt: rec?.lastSyncAt ?? this.lastSyncAt,
      lastSyncStatus: (rec?.lastSyncStatus as SourceHealth['lastSyncStatus']) ?? null,
      lastError: this.lastError,
      jobCount: rec?.jobCount ?? 0,
    };
  }

  getLastSyncTime(): Date | null {
    return this.lastSyncAt;
  }

  handleRateLimit(error: unknown): { shouldRetry: boolean; waitMs: number } {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const wait = retryAfter ? Math.min(Number(retryAfter) * 1000 || 30000, 120000) : 30000;
      return { shouldRetry: true, waitMs: wait };
    }
    return { shouldRetry: false, waitMs: 0 };
  }

  reportSourceError(error: Error): void {
    this.consecutiveFailures += 1;
    this.lastError = error.message;
  }

  protected async politeGet(url: string, config?: Record<string, unknown>): Promise<any> {
    const now = Date.now();
    const wait = Math.max(0, this.minIntervalMs - (now - this.lastRequestTime));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestTime = Date.now();
    try {
      const res = await this.http.get(url, config as any);
      this.consecutiveFailures = 0;
      return res;
    } catch (err) {
      this.reportSourceError(err as Error);
      const rl = this.handleRateLimit(err);
      if (rl.shouldRetry) {
        await new Promise((r) => setTimeout(r, rl.waitMs));
        return this.http.get(url, config as any);
      }
      throw err;
    }
  }

  markSyncSuccess(now: Date = new Date()): void {
    this.lastSyncAt = now;
    this.consecutiveFailures = 0;
  }
}
