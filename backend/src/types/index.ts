// JobHunter Ethiopia — Domain Types

export type SourceType =
  | 'OFFICIAL_API'
  | 'PUBLIC_FEED'
  | 'PUBLIC_ATS'
  | 'PERMITTED_HTML'
  | 'EXTERNAL_SEARCH'
  | 'MANUAL_IMPORT'
  | 'UNAVAILABLE';

export interface RawJobListing {
  sourceJobId?: string;
  url: string;
  title: string;
  employer?: string;
  employerWebsite?: string;
  description?: string;
  descriptionPlain?: string;
  requirements?: string;
  skills?: string[];
  sector?: string;
  locationRaw: string;
  region?: string;
  city?: string;
  employmentType?: string;
  experienceLevel?: string;
  educationLevel?: string;
  salaryRaw?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  publishedAt?: string | Date;
  deadline?: string | Date;
  applicationUrl?: string;
  applicationMethod?: 'URL' | 'EMAIL' | 'PHONE' | 'IN_PERSON' | 'PORTAL';
  applicationInstructions?: string;
  sourceAttribution: string;
}

export interface NormalizedJob {
  title: string;
  employer: string;
  employerWebsite?: string;
  description: string;
  descriptionPlain?: string;
  requirements?: ExtractedRequirements;
  skills: string[];
  sector: string;
  region: string;
  city?: string;
  locationRaw: string;
  employmentType: string;
  experienceLevel?: string;
  educationLevel: string;
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  salaryRaw?: string;
  publishedAt?: Date;
  deadline?: Date;
  originalUrl: string;
  applicationUrl?: string;
  applicationMethod?: string;
  applicationInstructions?: string;
  sourceAttribution: string;
  sourceId: string;
  sourceJobId?: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'CLAIMED_BY_EMPLOYER';
  expirationStatus: 'ACTIVE' | 'EXPIRED' | 'STALE' | 'LINK_BROKEN';
}

export interface ExtractedRequirements {
  education?: string;
  educationLevel?: string;
  experienceYears?: number;
  requiredSkills: string[];
  preferredSkills: string[];
  certifications: string[];
  languages: string[];
  eligibilityCriteria: string[];
}

export interface SourceHealth {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  enabled: boolean;
  ok: boolean;
  consecutiveFailures: number;
  lastSyncAt: Date | null;
  lastSyncStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED' | null;
  lastError?: string;
  jobCount: number;
}

export interface SearchQuery {
  q?: string;
  regions?: string[];
  cities?: string[];
  sectors?: string[];
  employmentType?: string[];
  educationLevel?: string[];
  experienceLevel?: string;
  salaryMin?: number;
  salaryMax?: number;
  publishedAfter?: Date;
  deadlineBefore?: Date;
  source?: string;
  status?: string;
  sort?: 'newest' | 'deadline' | 'match';
  limit?: number;
  cursor?: string;
}

export interface JobPage {
  jobs: RawJobListing[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface JobSourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly type: SourceType;
  readonly baseUrl: string;

  searchJobs(query: SearchQuery): Promise<JobPage>;
  getJobDetails(sourceJobId: string): Promise<RawJobListing>;
  fetchNextPage(cursor?: string): Promise<JobPage>;
  normalizeJob(raw: RawJobListing): NormalizedJob;
  validateJob(job: NormalizedJob): ValidationResult;
  getSourceHealth(): Promise<SourceHealth>;
  getLastSyncTime(): Date | null;
  handleRateLimit(error: unknown): { shouldRetry: boolean; waitMs: number };
  reportSourceError(error: Error): void;
}

// AI Engine types
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormatJson?: boolean;
}

export interface ChatResponse {
  content: string;
  provider: 'groq' | 'nvidia' | 'mistral';
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
}

export interface ProviderHealth {
  provider: 'groq' | 'nvidia' | 'mistral';
  available: boolean;
  latencyMs: number;
  message?: string;
}

export interface JobRequirements {
  education?: string;
  educationLevel?: string;
  experienceYears?: number | null;
  requiredSkills: string[];
  preferredSkills: string[];
  certifications: string[];
  languages: string[];
  eligibilityCriteria: string[];
}

export interface InterviewQuestion {
  question: string;
  hint?: string;
  topic?: string;
}

export interface AiProvider {
  readonly id: 'groq' | 'nvidia' | 'mistral';
  readonly name: string;
  health(): Promise<ProviderHealth>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatJson<T>(request: ChatRequest): Promise<{ data: T; meta: ChatResponse }>;
}

export interface ExtractedCv {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  education: Array<{
    institution: string;
    degree: string;
    field?: string;
    level?: string;
    cgpa?: number;
    startYear?: number;
    endYear?: number;
  }>;
  experience: Array<{
    employer: string;
    title: string;
    location?: string;
    isInternship?: boolean;
    description?: string;
  }>;
  skills: Array<{ name: string; category?: string; level?: string }>;
  certifications?: string[];
  languages?: string[];
  rawText?: string;
}

export interface MatchScoreDimension {
  name: string;
  score: number;       // 0..maxScore
  maxScore: number;
  notes: string;
}

export interface MatchResult {
  overallScore: number;          // 0..100
  dimensions: MatchScoreDimension[];
  strongMatches: string[];
  missingRequirements: string[];
  partialRequirements: string[];
  unknownRequirements: string[];
  disqualifiers: string[];
  aiExplanation?: string;
  providerUsed?: 'groq' | 'nvidia' | 'mistral' | 'deterministic';
  disclaimer: string;
}

export interface RiskAssessment {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  flags: Array<{ code: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string; evidence?: string }>;
}
