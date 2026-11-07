// JobHunter Ethiopia — Sync Worker
// Orchestrates periodic source synchronization, per-source health tracking,
// lastSyncAt timestamps, job counts, error logging, and expiration detection.
import { prisma } from '../db/prisma.js';
import { registry } from '../adapters/index.js';
import { upsertJob } from '../deduplicator/deduplicator.js';
import { BaseJobSourceAdapter } from '../adapters/base.js';

export interface SyncStats {
  sourceId: string;
  sourceName: string;
  itemsFetched: number;
  itemsAdded: number;
  itemsUpdated: number;
  durationMs: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  errorMessage?: string;
}

export async function syncSource(id: string): Promise<SyncStats> {
  const adapter = registry.get(id);
  if (!adapter) throw new Error(`Unknown source: ${id}`);

  // Ensure Source parent record exists for foreign-key relations
  await prisma.source.upsert({
    where: { id },
    update: {},
    create: { id, name: adapter.name, type: adapter.type, baseUrl: adapter.baseUrl },
  });

  const start = Date.now();
  let fetched = 0;
  let added = 0;
  let updated = 0;

  try {
    const page = await adapter.searchJobs({});
    fetched = page.jobs.length;

    for (const raw of page.jobs) {
      const normalized = adapter.normalizeJob(raw);
      const validation = adapter.validateJob(normalized);
      if (!validation.valid) continue;
      const res = await upsertJob(normalized);
      if (res.created) added++;
      if (res.updated) updated++;
    }

    if (adapter instanceof BaseJobSourceAdapter) adapter.markSyncSuccess();

    await prisma.sourceSyncLog.create({
      data: {
        sourceId: id,
        status: 'SUCCESS',
        itemsFetched: fetched,
        itemsAdded: added,
        itemsUpdated: updated,
        durationMs: Date.now() - start,
      },
    });

    const jobCount = await prisma.jobSourceReference.count({ where: { sourceId: id } });
    await prisma.source.upsert({
      where: { id },
      update: { lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS', jobCount, enabled: true },
      create: { id, name: adapter.name, type: adapter.type, baseUrl: adapter.baseUrl, lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS', jobCount },
    });

    return { sourceId: id, sourceName: adapter.name, itemsFetched: fetched, itemsAdded: added, itemsUpdated: updated, durationMs: Date.now() - start, status: 'SUCCESS' };
  } catch (err: any) {
    if (adapter instanceof BaseJobSourceAdapter) adapter.reportSourceError(err);
    await prisma.sourceSyncLog.create({
      data: {
        sourceId: id,
        status: 'FAILED',
        itemsFetched: fetched,
        errorMessage: err?.message?.slice(0, 500),
        durationMs: Date.now() - start,
      },
    });
    await prisma.source.upsert({
      where: { id },
      update: { lastSyncAt: new Date(), lastSyncStatus: 'FAILED' },
      create: { id, name: adapter.name, type: adapter.type, baseUrl: adapter.baseUrl, lastSyncAt: new Date(), lastSyncStatus: 'FAILED', jobCount: 0 },
    });
    return { sourceId: id, sourceName: adapter.name, itemsFetched: fetched, itemsAdded: added, itemsUpdated: updated, durationMs: Date.now() - start, status: 'FAILED', errorMessage: err?.message };
  }
}

export async function syncAll(): Promise<SyncStats[]> {
  const adapters = registry.list();
  const results: SyncStats[] = [];
  for (const a of adapters) {
    // Check if source is enabled in DB
    const rec = await prisma.source.findUnique({ where: { id: a.id } }).catch(() => null);
    if (rec && !rec.enabled) continue;
    results.push(await syncSource(a.id));
  }
  await markExpiredListings();
  return results;
}

export async function markExpiredListings(): Promise<number> {
  const res = await prisma.job.updateMany({
    where: {
      deadline: { lt: new Date() },
      expirationStatus: 'ACTIVE',
    },
    data: { expirationStatus: 'EXPIRED' },
  });
  return res.count;
}

export function startPeriodicSync(intervalHours = Number(process.env.SYNC_INTERVAL_HOURS || 6)): () => void {
  const ms = intervalHours * 60 * 60 * 1000;
  const handle = setInterval(() => {
    syncAll().catch((err) => console.error('[sync] periodic sync error', err));
  }, ms);
  return () => clearInterval(handle);
}
