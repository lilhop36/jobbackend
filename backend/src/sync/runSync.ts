import 'dotenv/config';
import { syncSource } from './syncWorker.js';
import { prisma } from '../db/prisma.js';

const source = process.argv[2] || 'ethiongojobs';
console.log(`[JobHunter] syncing real source: ${source}`);
const stats = await syncSource(source);
console.log(JSON.stringify(stats, null, 2));

const jobs = await prisma.job.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
console.log(`[JobHunter] sample stored jobs (${jobs.length}):`);
for (const j of jobs) {
  console.log(`- [${j.region}] ${j.title} @ ${j.employer} | ${j.sector} | ${j.sourceAttribution}`);
}
await prisma.$disconnect();
