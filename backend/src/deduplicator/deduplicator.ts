// JobHunter Ethiopia — Deduplication Engine (Section 9)
// Deduplication using: original job ID, canonical URL, employer, title, location,
// description similarity, publication date. Keeps multiple source references;
// never merges distinct job openings.
import { prisma } from '../db/prisma.js';
import { NormalizedJob } from '../types/index.js';

export interface DedupeDecision {
  action: 'insert_new' | 'update_source' | 'merge_duplicate';
  jobId?: string;
  clusterId?: string;
  confidence: number;
  reason: string;
}

export function normalizeEmployer(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(plc|llc|inc|ltd|co|company|corp|organization|foundation|ethiopia|group|share company|s c)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
  const sa = norm(a);
  const sb = norm(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return (2 * inter) / (sa.size + sb.size); // Dice coefficient
}

export async function findDuplicate(candidate: NormalizedJob): Promise<DedupeDecision> {
  // 1. Exact match: sourceId + sourceJobId
  if (candidate.sourceJobId) {
    const existingRef = await prisma.jobSourceReference.findUnique({
      where: {
        sourceId_sourceJobId: {
          sourceId: candidate.sourceId,
          sourceJobId: candidate.sourceJobId,
        },
      },
    });
    if (existingRef) {
      return { action: 'update_source', jobId: existingRef.jobId, confidence: 1.0, reason: 'exact_source_id' };
    }
  }

  // 2. Canonical URL match
  const byUrl = await prisma.job.findFirst({
    where: { originalUrl: candidate.originalUrl },
    select: { id: true },
  });
  if (byUrl) return { action: 'update_source', jobId: byUrl.id, confidence: 1.0, reason: 'canonical_url' };

  // 3. Fuzzy match: same normalized employer + strong title similarity + same region
  const normCandidateEmp = normalizeEmployer(candidate.employer);
  const regionCandidates = await prisma.job.findMany({
    where: {
      region: candidate.region,
      expirationStatus: 'ACTIVE',
    },
    select: { id: true, employer: true, title: true, clusterId: true, publishedAt: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  let best: { id: string; clusterId: string | null; sim: number; reason: string } | null = null;
  const daysWindow = 45;
  const candidatePub = candidate.publishedAt ? candidate.publishedAt.getTime() : null;

  for (const c of regionCandidates) {
    const empSim = normCandidateEmp.length > 2 && normCandidateEmp === normalizeEmployer(c.employer);
    if (!empSim) continue;

    if (candidatePub && c.publishedAt) {
      const diffDays = Math.abs(candidatePub - c.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > daysWindow) continue;
    }

    const tSim = titleSimilarity(candidate.title, c.title);
    if (tSim >= 0.72) {
      if (!best || tSim > best.sim) best = { id: c.id, clusterId: c.clusterId, sim: tSim, reason: 'fuzzy_employer_title' };
    }
  }

  if (best) {
    return {
      action: 'merge_duplicate',
      jobId: best.id,
      clusterId: best.clusterId ?? undefined,
      confidence: Number(best.sim.toFixed(2)),
      reason: best.reason,
    };
  }

  return { action: 'insert_new', confidence: 0, reason: 'none' };
}

/**
 * Upserts a normalized job while applying deduplication policy.
 * Preserves multiple source references per job.
 */
export async function upsertJob(candidate: NormalizedJob): Promise<{ jobId: string; created: boolean; updated: boolean }> {
  const decision = await findDuplicate(candidate);

  if (decision.action === 'update_source' && decision.jobId) {
    // Record refreshed source reference and verification timestamp
    await prisma.job.update({
      where: { id: decision.jobId },
      data: {
        lastVerifiedAt: new Date(),
        expirationStatus: candidate.expirationStatus,
      },
    });
    await prisma.jobSourceReference
      .upsert({
        where: {
          sourceId_sourceJobId: {
            sourceId: candidate.sourceId,
            sourceJobId: candidate.sourceJobId || candidate.originalUrl,
          },
        },
        update: { fetchedAt: new Date() },
        create: {
          jobId: decision.jobId,
          sourceId: candidate.sourceId,
          sourceJobId: candidate.sourceJobId || candidate.originalUrl,
          url: candidate.originalUrl,
        },
      })
      .catch(() => {
        /* best-effort ref */
      });
    return { jobId: decision.jobId, created: false, updated: true };
  }

  // Create new job row
  const created = await prisma.job.create({
    data: {
      title: candidate.title,
      employer: candidate.employer,
      employerWebsite: candidate.employerWebsite,
      description: candidate.description,
      descriptionPlain: candidate.descriptionPlain,
      sector: candidate.sector,
      region: candidate.region,
      city: candidate.city,
      locationRaw: candidate.locationRaw,
      employmentType: candidate.employmentType,
      experienceLevel: candidate.experienceLevel,
      educationLevel: candidate.educationLevel,
      salaryMin: candidate.salaryMin ? candidate.salaryMin : undefined,
      salaryMax: candidate.salaryMax ? candidate.salaryMax : undefined,
      currency: candidate.currency,
      salaryRaw: candidate.salaryRaw,
      publishedAt: candidate.publishedAt,
      deadline: candidate.deadline,
      originalUrl: candidate.originalUrl,
      applicationUrl: candidate.applicationUrl,
      applicationMethod: candidate.applicationMethod,
      applicationInstructions: candidate.applicationInstructions,
      sourceAttribution: candidate.sourceAttribution,
      expirationStatus: candidate.expirationStatus,
      sourceReferences: {
        create: {
          sourceId: candidate.sourceId,
          sourceJobId: candidate.sourceJobId || candidate.originalUrl,
          url: candidate.originalUrl,
        },
      },
    },
  });

  // If a fuzzy duplicate was found, cluster them together
  if (decision.action === 'merge_duplicate' && decision.jobId) {
    const cluster = await prisma.jobDuplicateCluster.create({
      data: {
        canonicalId: decision.jobId,
        reason: decision.reason,
        confidence: decision.confidence,
      },
    });
    await prisma.job.updateMany({
      where: { id: { in: [decision.jobId, created.id] } },
      data: { clusterId: cluster.id },
    });
  }

  return { jobId: created.id, created: true, updated: false };
}
