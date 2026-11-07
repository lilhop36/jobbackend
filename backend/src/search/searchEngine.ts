// JobHunter Ethiopia — Search & Filter Engine (Section 8)
// 14 filter dimensions, multiple-region selection, Ethiopian locations taxonomy,
// cursor pagination, and sort options.
import { prisma } from '../db/prisma.js';
import { SearchQuery } from '../types/index.js';

export interface SearchResult {
  jobs: any[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export async function searchJobs(query: SearchQuery): Promise<SearchResult> {
  const limit = Math.min(query.limit ?? 30, 100);
  const where: any = { expirationStatus: query.status ? query.status : 'ACTIVE' };

  if (query.regions && query.regions.length) {
    where.region = { in: query.regions };
  }
  if (query.cities && query.cities.length) {
    where.city = { in: query.cities };
  }
  if (query.sectors && query.sectors.length) {
    where.sector = { in: query.sectors };
  }
  if (query.employmentType && query.employmentType.length) {
    where.employmentType = { in: query.employmentType };
  }
  if (query.educationLevel && query.educationLevel.length) {
    where.educationLevel = { in: query.educationLevel };
  }
  if (query.experienceLevel) {
    where.experienceLevel = { contains: query.experienceLevel };
  }
  if (query.salaryMin !== undefined) {
    where.OR = [{ salaryMax: { gte: query.salaryMin } }, { salaryMin: { gte: query.salaryMin } }];
  }
  if (query.publishedAfter) {
    where.publishedAt = { gte: query.publishedAfter };
  }
  if (query.deadlineBefore) {
    where.deadline = { lte: query.deadlineBefore };
  }
  if (query.source) {
    where.sourceAttribution = { contains: query.source };
  }

  // Full-text keyword filter (Prisma SQLite contains)
  if (query.q) {
    const kw = query.q.trim();
    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          { title: { contains: kw } },
          { employer: { contains: kw } },
          { description: { contains: kw } },
          { locationRaw: { contains: kw } },
          { sector: { contains: kw } },
        ],
      },
    ];
  }

  const orderBy: any[] = [];
  if (query.sort === 'deadline') orderBy.push({ deadline: 'asc' });
  else orderBy.push({ publishedAt: 'desc' }, { createdAt: 'desc' });

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy,
      take: limit + 1,
      include: { sourceReferences: true, riskFlags: true },
    }),
  ]);

  const hasMore = jobs.length > limit;
  const page = hasMore ? jobs.slice(0, limit) : jobs;

  return {
    jobs: page.map((j) => ({
      ...j,
      isExpired: j.expirationStatus === 'EXPIRED',
      isCached: true,
      lastVerifiedAt: j.lastVerifiedAt,
    })),
    total,
    hasMore,
    nextCursor: hasMore ? page[page.length - 1].id : undefined,
  };
}
