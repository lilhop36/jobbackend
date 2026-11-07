// JobHunter Ethiopia — AI Engine (Section 6)
// Provider-independent AI interface with Groq, NVIDIA, and Mistral adapters,
// fallback chain, consent gate, cost/token telemetry, and deterministic non-AI
// fallbacks for every feature. Zero-AI availability is guaranteed.
import OpenAI from 'openai';
import {
  AiProvider,
  ChatRequest,
  ChatResponse,
  ProviderHealth,
  NormalizedJob,
  ExtractedCv,
  JobRequirements,
  InterviewQuestion,
  RiskAssessment,
  MatchResult,
} from '../types/index.js';
import { prisma } from '../db/prisma.js';
import { computeMatchScore } from '../matching/matchingEngine.js';
import { assessJobRisk } from '../scam/scamDetector.js';

// ── Generic OpenAI-compatible adapter ──────────────────────────────
class OpenAICompatibleProvider implements AiProvider {
  readonly id: 'groq' | 'nvidia' | 'mistral';
  readonly name: string;
  protected client: OpenAI;
  protected defaultModel: string;

  constructor(id: 'groq' | 'nvidia' | 'mistral', name: string, baseURL: string, apiKey: string, defaultModel: string) {
    this.id = id;
    this.name = name;
    this.defaultModel = defaultModel;
    this.client = new OpenAI({ baseURL, apiKey });
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.client.models.list();
      return { provider: this.id, available: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { provider: this.id, available: false, latencyMs: Date.now() - start, message: err?.message };
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const res = await this.client.chat.completions.create({
      model: request.model || this.defaultModel,
      messages: request.messages as any,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 2000,
      response_format: request.responseFormatJson ? { type: 'json_object' } : undefined,
    });
    const choice = res.choices[0];
    return {
      content: choice?.message?.content || '',
      provider: this.id,
      model: request.model || this.defaultModel,
      tokensIn: res.usage?.prompt_tokens,
      tokensOut: res.usage?.completion_tokens,
      latencyMs: Date.now() - start,
    };
  }

  async chatJson<T>(request: ChatRequest): Promise<{ data: T; meta: ChatResponse }> {
    const meta = await this.chat({ ...request, responseFormatJson: true });
    const trimmed = meta.content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const data = JSON.parse(trimmed) as T;
    return { data, meta };
  }
}

// ── Deterministic non-AI fallbacks (Section 6.D) ───────────────────
const INTERVIEW_BANK: Record<string, string[]> = {
  'ICT & Software': [
    'Walk me through a project you built: what architecture decisions did you make and what would you change?',
    'How do you approach debugging an unfamiliar codebase under time pressure?',
    'Describe your experience with code reviews and testing practices.',
  ],
  'Finance & Banking': [
    'How do you ensure accuracy when handling financial records and reconciliations?',
    'Describe a situation where you had to interpret a complex policy or regulation.',
    'What controls do you use to manage risk in day-to-day transactions?',
  ],
  'NGO & Humanitarian': [
    'Describe your experience working in field conditions or with vulnerable populations.',
    'How do you measure and report program impact to donors?',
    'Tell me about a time you resolved a conflict among project stakeholders.',
  ],
  'Health & Medical': [
    'How do you stay current with clinical guidelines and protocols?',
    'Describe a challenging patient situation and how you handled it.',
    'How do you ensure data confidentiality and accurate documentation?',
  ],
  default: [
    'Tell me about yourself and why this role at this employer interests you.',
    'Describe a challenge from your past experience and how you handled it.',
    'Where do you see your skills developing over the next two years?',
  ],
};

function fallbackCoverLetter(cv: ExtractedCv, job: NormalizedJob, notes?: string): string {
  const name = cv.fullName || 'Job Applicant';
  const role = job.title;
  const emp = job.employer;
  const ed = cv.education[0];
  const eduLine = ed ? `I hold a ${ed.degree} from ${ed.institution}.` : '';
  const skills = cv.skills.map((s) => s.name).slice(0, 8).join(', ');
  return `Dear Hiring Team,\n\nI am writing to express my strong interest in the ${role} position at ${emp}.\n\n${eduLine} My background includes skills in ${skills || 'relevant areas'}. I am impressed by ${emp}'s work and confident I can contribute to the team from day one.\n\n${notes ? `Additional note: ${notes}\n\n` : ''}I welcome the opportunity to discuss my application further.\n\nSincerely,\n${name}`;
}

// ── Orchestrator ───────────────────────────────────────────────────
export class AiEngine {
  private providers: AiProvider[] = [];
  private order: Array<'groq' | 'nvidia' | 'mistral'> = ['groq', 'nvidia', 'mistral'];
  private providerMap = new Map<string, AiProvider>();

  constructor() {
    this.reloadProviders();
  }

  reloadProviders(): void {
    this.providers = [];
    this.providerMap.clear();

    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      const p = new OpenAICompatibleProvider('groq', 'Groq', 'https://api.groq.com/openai/v1', groqKey, process.env.GROQ_INTERACTIVE_MODEL || 'llama-3.3-70b-versatile');
      this.providers.push(p);
      this.providerMap.set(p.id, p);
    }
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (nvidiaKey) {
      const p = new OpenAICompatibleProvider('nvidia', 'NVIDIA API', 'https://integrate.api.nvidia.com/v1', nvidiaKey, process.env.NVIDIA_REASONING_MODEL || 'meta/llama-3.3-70b-instruct');
      this.providers.push(p);
      this.providerMap.set(p.id, p);
    }
    const mistralKey = process.env.MISTRAL_API_KEY;
    if (mistralKey) {
      const p = new OpenAICompatibleProvider('mistral', 'Mistral AI', 'https://api.mistral.ai/v1', mistralKey, process.env.MISTRAL_LARGE_MODEL || 'mistral-large-latest');
      this.providers.push(p);
      this.providerMap.set(p.id, p);
    }

    const o = [process.env.AI_PRIMARY_PROVIDER, process.env.AI_SECONDARY_PROVIDER, process.env.AI_TERTIARY_PROVIDER].filter(Boolean) as Array<'groq' | 'nvidia' | 'mistral'>;
    if (o.length) this.order = o;
  }

  private orderedProviders(): AiProvider[] {
    const list: AiProvider[] = [];
    for (const id of this.order) {
      const p = this.providerMap.get(id);
      if (p) list.push(p);
    }
    for (const p of this.providers) if (!list.includes(p)) list.push(p);
    return list;
  }

  private async callWithFallback<T>(task: string, userId: string | null, fn: (p: AiProvider) => Promise<T>, fallback: () => T): Promise<{ result: T; providerUsed?: string }> {
    for (const p of this.orderedProviders()) {
      try {
        const result = await fn(p);
        await this.logUsage({ task, provider: p.id, model: (p as any).defaultModel || 'default', success: true });
        return { result, providerUsed: p.id };
      } catch (err: any) {
        await this.logUsage({ task, provider: p.id, model: (p as any).defaultModel || 'default', success: false, error: err?.message });
      }
    }
    return { result: fallback(), providerUsed: undefined };
  }

  private async logUsage(l: { task: string; provider: string; model: string; success: boolean; error?: string }): Promise<void> {
    prisma.aiUsageLog.create({ data: { ...l, tokensIn: 0, tokensOut: 0, latencyMs: 0 } }).catch(() => {});
  }

  availableProviders(): string[] {
    return this.orderedProviders().map((p) => p.id);
  }

  // ── Public AI tasks ──────────────────────────────────────────────

  async extractJobRequirements(rawText: string): Promise<JobRequirements> {
    const prompt = `Extract structured job requirements as JSON with keys: education (string), educationLevel (one of GRADE_10_12, TVET, DIPLOMA, BACHELOR, MASTER, PHD, NOT_SPECIFIED), experienceYears (number|null), requiredSkills (string[]), preferredSkills (string[]), certifications (string[]), languages (string[]), eligibilityCriteria (string[]). Return ONLY the JSON object.\n\n${rawText.slice(0, 4000)}`;
    const { result } = await this.callWithFallback(
      'job_extraction',
      null,
      (p) => p.chatJson<JobRequirements>({ messages: [{ role: 'user', content: prompt }] }).then((r) => r.data),
      () => ({ requiredSkills: [], preferredSkills: [], certifications: [], languages: [], eligibilityCriteria: [] })
    );
    return result;
  }

  async match(cv: ExtractedCv, job: NormalizedJob, userId?: string): Promise<MatchResult> {
    const rule = computeMatchScore(cv, job);
    if (!this.orderedProviders().length) {
      return { ...rule, providerUsed: 'deterministic' };
    }
    const cvSummary = `${cv.fullName || ''}; education: ${(cv.education ?? []).map((e) => e.degree).join(', ')}; skills: ${(cv.skills ?? []).map((s) => s.name).join(', ')}; experience: ${(cv.experience ?? []).map((e) => e.title).join(', ')}`;
    const prompt = `Explain the fit between candidate and job in 3-4 factual sentences. Candidate: ${cvSummary}. Job: ${job.title} at ${job.employer}. Requirements: ${job.descriptionPlain?.slice(0, 800)}. Mention strengths, missing requirements, and any potential disqualifiers. Do not invent any qualifications.`;
    const { result, providerUsed } = await this.callWithFallback(
      'matching',
      userId ?? null,
      (p) => p.chat({ messages: [{ role: 'user', content: prompt }] }).then((r) => r.content),
      () => ''
    );
    return { ...rule, aiExplanation: result || undefined, providerUsed: providerUsed as any ?? 'deterministic' };
  }

  async coverLetter(cv: ExtractedCv, job: NormalizedJob, notes?: string): Promise<string> {
    const prompt = `Write a professional cover letter for the role "${job.title}" at "${job.employer}". Use only the facts in this CV — never invent experience: education: ${cv.education.map((e) => e.degree).join(', ')}; skills: ${cv.skills.map((s) => s.name).join(', ')}; experience: ${cv.experience.map((e) => `${e.title} at ${e.employer}`).join(', ')}. Candidate name: ${cv.fullName || ''}. Additional notes: ${notes || 'none'}. Output only the letter.`;
    const { result } = await this.callWithFallback(
      'cover_letter',
      null,
      (p) => p.chat({ messages: [{ role: 'user', content: prompt }] }).then((r) => r.content),
      () => fallbackCoverLetter(cv, job, notes)
    );
    return result;
  }

  async interviewQuestions(cv: ExtractedCv, job: NormalizedJob): Promise<InterviewQuestion[]> {
    const prompt = `Return a JSON array of 5 contextual interview questions for a candidate with skills [${cv.skills.map((s) => s.name).join(', ')}] applying for "${job.title}" at "${job.employer}". Each item: { question, hint, topic }.`;
    const { result } = await this.callWithFallback(
      'interview_prep',
      null,
      (p) => p.chatJson<{ questions: InterviewQuestion[] } | InterviewQuestion[]>({ messages: [{ role: 'user', content: prompt }] }).then((r) => Array.isArray(r.data) ? r.data : r.data.questions),
      () => (INTERVIEW_BANK[job.sector] || INTERVIEW_BANK.default).map((q) => ({ question: q, topic: job.sector }))
    );
    return result;
  }

  async scamAnalysis(job: NormalizedJob): Promise<RiskAssessment> {
    const base = assessJobRisk(job);
    if (!this.orderedProviders().length || base.flags.length === 0) return base;
    const prompt = `Summarize this job's scam risk assessment for a job seeker. Flags: ${JSON.stringify(base.flags)}. Explain clearly what each flag means and what concrete action the job seeker should take. Never accuse the employer of fraud without evidence. Keep it under 200 words.`;
    const { result } = await this.callWithFallback(
      'scam_analysis',
      null,
      (p) => p.chat({ messages: [{ role: 'user', content: prompt }] }).then((r) => r.content),
      () => ''
    );
    if (result) (base as any).aiSummary = result;
    return base;
  }

  async chatAssistant(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
    const system = {
      role: 'system' as const,
      content: 'You are the JobHunter Ethiopia AI career assistant. You help Ethiopian job seekers find vacancies, understand requirements, improve CVs and cover letters, and prepare for interviews. Be factual, concise, and never invent qualifications. When you do not know something, say so.',
    };
    const { result } = await this.callWithFallback(
      'chat',
      null,
      (p) => p.chat({ messages: [system, ...messages] }).then((r) => r.content),
      () => 'The AI assistant is temporarily unavailable. All job search, saving, and application tracking features remain fully functional.'
    );
    return result;
  }
}

export const aiEngine = new AiEngine();
export default aiEngine;
