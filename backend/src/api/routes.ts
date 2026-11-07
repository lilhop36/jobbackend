// JobHunter Ethiopia — REST API Router
import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { registry } from '../adapters/index.js';
import { searchJobs } from '../search/searchEngine.js';
import { syncSource, syncAll } from '../sync/syncWorker.js';
import { aiEngine } from '../ai/aiEngine.js';
import { ETHIOPIAN_REGIONS, MAJOR_CITIES } from '../normalizer/ethiopianLocations.js';
import { assessJobRisk } from '../scam/scamDetector.js';

export const api: Router = Router();

// ── Health ──────────────────────────────────────────────────────────
api.get('/health', async (_req: Request, res: Response) => {
  const sources = await registry.healthAll();
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  res.json({
    status: dbOk ? 'ok' : 'degraded',
    version: '0.1.0',
    database: dbOk ? 'up' : 'down',
    aiProvidersConfigured: aiEngine.availableProviders(),
    sourcesHealthy: sources.filter((s) => s.ok).length,
    sourcesTotal: sources.length,
    timestamp: new Date().toISOString(),
  });
});

// ── Sources ────────────────────────────────────────────────────────
api.get('/sources', async (_req: Request, res: Response) => {
  const health = await registry.healthAll();
  const dbSources = await prisma.source.findMany();
  const map = new Map(dbSources.map((s) => [s.id, s]));
  const merged = health.map((h) => {
    const db = map.get(h.sourceId);
    return { ...h, baseUrl: registry.get(h.sourceId)?.baseUrl, pollIntervalMin: db?.pollIntervalMin ?? 360 };
  });
  res.json(merged);
});

api.post('/sources/sync', async (req: Request, res: Response) => {
  const { sourceId } = req.body || {};
  try {
    const results = sourceId ? [await syncSource(sourceId)] : await syncAll();
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

api.patch('/sources/:id', async (req: Request, res: Response) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });
  await registry.setEnabled(req.params.id, enabled);
  res.json({ id: req.params.id, enabled });
});

// ── Jobs ───────────────────────────────────────────────────────────
api.get('/jobs', async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const query = {
    q: q.q,
    regions: q.regions ? q.regions.split(',').map((s) => s.trim()) : undefined,
    cities: q.cities ? q.cities.split(',').map((s) => s.trim()) : undefined,
    sectors: q.sectors ? q.sectors.split(',').map((s) => s.trim()) : undefined,
    employmentType: q.employmentType ? q.employmentType.split(',') : undefined,
    educationLevel: q.educationLevel ? q.educationLevel.split(',') : undefined,
    experienceLevel: q.experienceLevel,
    salaryMin: q.salaryMin ? Number(q.salaryMin) : undefined,
    salaryMax: q.salaryMax ? Number(q.salaryMax) : undefined,
    publishedAfter: q.publishedAfter ? new Date(q.publishedAfter) : undefined,
    deadlineBefore: q.deadlineBefore ? new Date(q.deadlineBefore) : undefined,
    source: q.source,
    status: q.status,
    sort: q.sort as any,
    limit: q.limit ? Number(q.limit) : 30,
    cursor: q.cursor,
  };
  const result = await searchJobs(query);
  res.json(result);
});

api.get('/jobs/:id', async (req: Request, res: Response) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: { sourceReferences: { include: { source: true } }, riskFlags: true },
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({
    ...job,
    isExpired: job.expirationStatus === 'EXPIRED',
    isCached: true,
    lastVerifiedAt: job.lastVerifiedAt,
  });
});

// ── CV ─────────────────────────────────────────────────────────────
api.post('/cv', async (req: Request, res: Response) => {
  const { userId = 'anonymous', title = 'My CV', rawText, education = [], experience = [], skills = [], languages = [], fullName, email, phone, location } = req.body || {};
  // ensure user exists
  await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId } });
  const cv = await prisma.cvProfile.create({
    data: {
      userId,
      title,
      fullName,
      email,
      phone,
      location,
      rawText,
      education: { create: education.map((e: any) => ({ institution: e.institution, degree: e.degree, field: e.field, level: e.level, cgpa: e.cgpa })) },
      experience: { create: experience.map((x: any) => ({ employer: x.employer, title: x.title, location: x.location, isInternship: !!x.isInternship, description: x.description })) },
      skills: { create: skills.map((s: any) => ({ name: s.name, category: s.category, level: s.level })) },
    },
    include: { education: true, experience: true, skills: true },
  });
  res.json(cv);
});

api.get('/cv/:id', async (req: Request, res: Response) => {
  const cv = await prisma.cvProfile.findUnique({
    where: { id: req.params.id },
    include: { education: true, experience: true, skills: true },
  });
  if (!cv) return res.status(404).json({ error: 'CV not found' });
  res.json(cv);
});

// ── Matching & AI ──────────────────────────────────────────────────
api.post('/match', async (req: Request, res: Response) => {
  const { cvId, jobId } = req.body || {};
  if (!cvId || !jobId) return res.status(400).json({ error: 'cvId and jobId required' });
  const [cv, job] = await Promise.all([
    prisma.cvProfile.findUnique({ where: { id: cvId }, include: { education: true, experience: true, skills: true } }),
    prisma.job.findUnique({ where: { id: jobId } }),
  ]);
  if (!cv || !job) return res.status(404).json({ error: 'CV or Job not found' });
  const result = await aiEngine.match(cv as any, job as any, cv.userId);
  await prisma.jobMatchCache
    .upsert({
      where: { cvId_jobId: { cvId, jobId } },
      update: {
        score: result.overallScore,
        educationScore: result.dimensions.find((d) => d.name === 'Education')?.score ?? 0,
        skillsScore: result.dimensions.find((d) => d.name === 'Required Skills')?.score ?? 0,
        experienceScore: result.dimensions.find((d) => d.name === 'Experience')?.score ?? 0,
        strongMatches: JSON.stringify(result.strongMatches),
        missingRequirements: JSON.stringify(result.missingRequirements),
        partialRequirements: JSON.stringify(result.partialRequirements),
        unknownRequirements: JSON.stringify(result.unknownRequirements),
        disqualifiers: JSON.stringify(result.disqualifiers),
        aiExplanation: result.aiExplanation,
        providerUsed: result.providerUsed,
        calculatedAt: new Date(),
      },
      create: {
        cvId,
        jobId,
        contentHash: String(result.overallScore),
        score: result.overallScore,
        educationScore: 0,
        skillsScore: 0,
        experienceScore: 0,
        strongMatches: JSON.stringify(result.strongMatches),
        missingRequirements: JSON.stringify(result.missingRequirements),
        partialRequirements: JSON.stringify(result.partialRequirements),
        unknownRequirements: JSON.stringify(result.unknownRequirements),
        disqualifiers: JSON.stringify(result.disqualifiers),
      },
    })
    .catch(() => {});
  res.json(result);
});

api.post('/cover-letter', async (req: Request, res: Response) => {
  const { cvId, jobId, notes } = req.body || {};
  const [cv, job] = await Promise.all([
    prisma.cvProfile.findUnique({ where: { id: cvId }, include: { education: true, experience: true, skills: true } }),
    prisma.job.findUnique({ where: { id: jobId } }),
  ]);
  if (!cv || !job) return res.status(404).json({ error: 'CV or Job not found' });
  const letter = await aiEngine.coverLetter(cv as any, job as any, notes);
  res.json({ letter });
});

api.post('/interview-prep', async (req: Request, res: Response) => {
  const { cvId, jobId } = req.body || {};
  const [cv, job] = await Promise.all([
    prisma.cvProfile.findUnique({ where: { id: cvId }, include: { education: true, experience: true, skills: true } }),
    prisma.job.findUnique({ where: { id: jobId } }),
  ]);
  if (!cv || !job) return res.status(404).json({ error: 'CV or Job not found' });
  const questions = await aiEngine.interviewQuestions(cv as any, job as any);
  res.json({ questions });
});

api.post('/scam-check/:id', async (req: Request, res: Response) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const assessment = await aiEngine.scamAnalysis(job as any);
  for (const f of assessment.flags) {
    await prisma.riskFlag
      .create({ data: { jobId: job.id, code: f.code, severity: f.severity, reason: f.reason, evidence: f.evidence } })
      .catch(() => {});
  }
  res.json(assessment);
});

api.post('/assistant/chat', async (req: Request, res: Response) => {
  const { messages = [] } = req.body || {};
  const reply = await aiEngine.chatAssistant(messages);
  res.json({ reply, providerUsed: aiEngine.availableProviders()[0] || 'deterministic' });
});

// ── Applications tracker (10 statuses) ─────────────────────────────
const STATUSES = ['INTERESTED','SAVED','PREPARING','APPLIED','ASSESSMENT','INTERVIEW','OFFER','REJECTED','WITHDRAWN','EXPIRED'];

api.get('/applications', async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'anonymous';
  const records = await prisma.applicationRecord.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { job: true },
  });
  res.json(records);
});

api.post('/applications', async (req: Request, res: Response) => {
  const { userId = 'anonymous', jobId, employer = 'Employer', jobTitle = 'Role', status = 'INTERESTED', notes, cvVersion, followUpDate, interviewDate } = req.body || {};
  await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId } });
  const rec = await prisma.applicationRecord.create({
    data: {
      userId,
      jobId,
      employer,
      jobTitle,
      status: STATUSES.includes(status) ? status : 'INTERESTED',
      notes,
      cvVersion,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      interviewDate: interviewDate ? new Date(interviewDate) : undefined,
      appliedAt: status === 'APPLIED' ? new Date() : undefined,
      history: JSON.stringify([{ status, timestamp: new Date().toISOString() }]),
    },
  });
  res.json(rec);
});

api.patch('/applications/:id', async (req: Request, res: Response) => {
  const { status, notes, followUpDate, interviewDate } = req.body || {};
  const existing = await prisma.applicationRecord.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Application record not found' });
  const history = JSON.parse(existing.history || '[]');
  if (status && status !== existing.status) history.push({ status, timestamp: new Date().toISOString() });
  const rec = await prisma.applicationRecord.update({
    where: { id: req.params.id },
    data: {
      status: STATUSES.includes(status) ? status : existing.status,
      notes: notes !== undefined ? notes : existing.notes,
      followUpDate: followUpDate !== undefined ? (followUpDate ? new Date(followUpDate) : null) : existing.followUpDate,
      interviewDate: interviewDate !== undefined ? (interviewDate ? new Date(interviewDate) : null) : existing.interviewDate,
      appliedAt: status === 'APPLIED' && !existing.appliedAt ? new Date() : existing.appliedAt,
      history: JSON.stringify(history),
    },
  });
  res.json(rec);
});

// ── Saved jobs ─────────────────────────────────────────────────────
api.get('/saved', async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'anonymous';
  const saved = await prisma.savedJob.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { job: true },
  });
  res.json(saved);
});

api.post('/saved', async (req: Request, res: Response) => {
  const { userId = 'anonymous', jobId, notes } = req.body || {};
  if (!jobId) return res.status(400).json({ error: 'jobId required' });
  await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId } });
  const saved = await prisma.savedJob.upsert({
    where: { userId_jobId: { userId, jobId } },
    update: { notes },
    create: { userId, jobId, notes },
  });
  res.json(saved);
});

api.delete('/saved/:jobId', async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'anonymous';
  await prisma.savedJob.deleteMany({ where: { userId, jobId: req.params.jobId } });
  res.json({ ok: true });
});

// ── Meta / Taxonomies ──────────────────────────────────────────────
api.get('/meta/regions', (_req: Request, res: Response) => {
  res.json({ regions: ETHIOPIAN_REGIONS, majorCities: MAJOR_CITIES });
});
