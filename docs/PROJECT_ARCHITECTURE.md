# JobHunter Ethiopia — Project Architecture

**Author:** Manus AI
**Date:** November 2026
**Version:** 1.0.0
**Status:** Phase 0 — Research and Feasibility

---

## 1. System Overview

JobHunter Ethiopia is an AI-powered Android job discovery, matching, and application assistant built specifically for the Ethiopian employment market. It aggregates vacancies from multiple Ethiopian job portals, government channels, NGO/UN sources, and employers, then helps users discover, evaluate, and apply for opportunities while managing their entire job search from one application.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Android Client (Kotlin + Jetpack Compose)       │
│  UI (13 screens) ◄──► ViewModels ◄──► Domain Use Cases ◄──► Repos      │
│        ▲                                                     ▲         │
│        │ WorkManager sync                                    │         │
│        ▼                                                     ▼         │
│   Room DB (cache)                                     Retrofit / OkHttp│
└────────────────────────────────────────────────────────────────────────┘
                                     │ HTTPS
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Backend (NestJS + TypeScript)                   │
│                                                                        │
│  REST API Gateway  ──►  Auth & Users  ──►  Jobs Module ──► Prisma      │
│                                               ▲              │         │
│                                               │              ▼         │
│  Adapter Registry  ◄──  Sync Workers  ───────┴────► PostgreSQL         │
│  (Ethiojobs, EthioNGOJobs, GeezJobs,                                   │
│   Reporter, Ezega, Etcareers, ICTJobs,                                 │
│   ReliefWeb v2, WHO RSS, PSCAMS...)                                    │
│                                                                        │
│  AI Engine (provider-independent interface)                            │
│  ├── GroqAdapter   (llama-3.3-70b-versatile, llama-3.1-8b-instant)      │
│  ├── NVIDIAAdapter (llama-3.3-70b, nemotron-3-super, mistral)          │
│  └── MistralAdapter(mistral-large, ministral-3b, mistral-ocr)          │
└────────────────────────────────────────────────────────────────────────┘
```

The system is intentionally **backend-centric for heavy lifting** (aggregation, normalization, AI orchestration) and **Android-centric for user experience** (offline capability, transparent scoring, application tracking, notifications).

---

## 2. Technology Stack Decisions

### 2.1 Android Client (Section 13)

| Component | Technology | Rationale |
|---|---|---|
| Language | **Kotlin 2.x** | Modern Android standard |
| UI toolkit | **Jetpack Compose + Material 3** | Declarative UI; native light/dark theming |
| Architecture | **MVVM / Clean Architecture** | Testable, layered separation of concerns |
| Local database | **Room** | Offline-first cache with Flow observation |
| Networking | **Retrofit 2 + OkHttp 4** | Type-safe REST client with gzip, retry, caching |
| Async | **Kotlin Coroutines + Flow** | Idiomatic Kotlin concurrency |
| Background work | **WorkManager** | Guaranteed periodic sync and notification checks |
| Dependency injection | **Hilt** (with manual DI fallback if needed) | Official Android DI |
| Navigation | **Navigation Compose 2.8+** | Type-safe Compose navigation |
| Key-value storage | **Jetpack DataStore** | Preferences, consent flags, AI budget settings |
| Lists | **Paging 3** | Memory-efficient infinite job scrolling |

### 2.2 Backend (Section 13)

| Component | Technology | Rationale |
|---|---|---|
| Runtime | **Node.js 22 LTS** | Sandbox pre-installed; huge ecosystem |
| Framework | **NestJS 10 (TypeScript)** | Modular architecture, DI, class validation, OpenAPI |
| ORM | **Prisma 6** | Type-safe schemas, migrations, relations |
| Database | **PostgreSQL 16** (SQLite for dev/testing) | Full-text search, JSONB, concurrency |
| Background tasks | **NestJS Schedule (cron workers)** | Periodic source synchronization without Redis |
| HTTP clients | **Axios + Cheerio** | Polite feed polling and HTML parsing |
| AI SDK | **Official OpenAI SDK** with baseURL overrides | One client for all three OpenAI-compatible providers |
| Docs | **Swagger/OpenAPI** | Live API documentation |
| Deployment | **Docker Compose** | Reproducible builds and deployment |

**Security rule enforced by architecture:** NVIDIA, Groq, and Mistral API keys live exclusively in backend `.env` files and **never appear inside the Android APK** (Section 13).

---

## 3. Modular Adapter Architecture (Section 5)

Every job source implements a common TypeScript interface:

```typescript
export interface JobSourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly type: SourceType; // OFFICIAL_API | PUBLIC_FEED | PUBLIC_ATS | PERMITTED_HTML | EXTERNAL_SEARCH | MANUAL_IMPORT | UNAVAILABLE

  searchJobs(query: SearchQuery): Promise<JobPage>;
  getJobDetails(sourceJobId: string): Promise<NormalizedJob>;
  fetchNextPage(cursor?: string): Promise<JobPage>;
  normalizeJob(raw: unknown): NormalizedJob;
  validateJob(job: NormalizedJob): ValidationResult;
  getSourceHealth(): Promise<SourceHealth>;
  getLastSyncTime(): Date | null;
  handleRateLimit(error: unknown): RateLimitAction;
  reportSourceError(error: Error): void;
}
```

The **Adapter Registry** manages the full source fleet:

- Enable/disable sources individually (a failing source never halts the aggregator).
- Source configuration (base URLs, poll interval, request concurrency, backoff policy).
- Per-source health checks, error budgets, and circuit breakers.
- Synchronization schedules with last-successful-sync timestamps and per-source job counts.
- Rate-limiting middleware (default ~1 req/s per domain) with jittered exponential backoff.
- Retry policies that distinguish transient 5xx/429 errors from permanent 404/410 errors.

Each adapter emits **normalized job records** conforming to the unified schema; deduplication and persistence are registry-level responsibilities.

---

## 4. AI Engine Architecture (Section 6)

### 4.1 Provider-Independent Interface

```typescript
export interface AiProvider {
  readonly id: 'groq' | 'nvidia' | 'mistral';
  readonly name: string;
  health(): Promise<ProviderHealth>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatJson<T>(request: ChatRequest, schema?: JsonSchema): Promise<T>;
}

export interface AiEngine {
  extractJobRequirements(rawText: string): Promise<JobRequirements>;
  analyzeCv(text: string): Promise<ExtractedCv>;
  matchCandidateToJob(cv: ExtractedCv, job: NormalizedJob): Promise<MatchResult>;
  generateCoverLetter(cv: ExtractedCv, job: NormalizedJob, notes?: string): Promise<string>;
  prepareInterviewQuestions(cv: ExtractedCv, job: NormalizedJob): Promise<InterviewQuestion[]>;
  classifyJob(job: NormalizedJob): Promise<JobClassification>;
  assessJobRisk(job: NormalizedJob): Promise<RiskAssessment>;
  chatAssistant(messages: ChatMessage[], streaming?: boolean): AsyncIterable<string> | Promise<string>;
}
```

### 4.2 Selection, Fallback, and Consent (Section 6.B)

- Default provider order: **Groq → NVIDIA → Mistral**.
- Provider health probes every 5 minutes; three consecutive failures trip the breaker.
- **Consent gate:** CV extraction and matching state which provider will receive the data and obtain explicit user consent. Rerouting sensitive data to a fallback requires renewed consent; otherwise the deterministic fallback runs.
- **Total-outage guarantee:** all core features (search, filtering, saved jobs, application tracking, CV management, offline use) operate when **zero AI providers** are available (Section 6.E).

### 4.3 Budget and Telemetry (Section 6.E)

- Token and cost counters per task and per provider.
- Caching of match results by content hash (identical job+CV pairs never re-scored).
- Per-user daily AI budget with graceful degradation to deterministic fallbacks.
- Privacy-conscious logging: CV content is redacted; only token counts, latency, and provider ID are retained.

---

## 5. Matching Engine (Section 7)

The match score (0–100) is **transparent and decomposed**:

| Dimension | Weight | Criteria |
|---|---|---|
| Education | 15% | Degree level vs. requirement; TVET/diploma recognition; CGPA when requested |
| Required skills | 30% | Hard skills intersection with synonym matching |
| Preferred skills | 10% | Soft/preferred skills overlap |
| Experience | 20% | Years and level of experience vs. required |
| Professional qualifications | 10% | Certifications, licenses |
| Location | 5% | Region/city compatibility (user preference) |
| Language requirements | 5% | English/Amharic/Afaan Oromo match |
| Other explicit criteria | 5% | Sector, employment type fit |

**Honesty rules (non-negotiable):**

1. Hard requirements are separated from preferences; any failing hard requirement is labeled a **potential disqualifier**.
2. If essential information is missing, the engine reports **unknown requirements** and never claims eligibility.
3. The match score is explicitly **not a probability of employment**.
4. The engine **never invents CV experience**.

Two-stage execution: the rule-based score is computed instantly and offline-capable; the AI reasoning layer (explanations, skill gap analysis) runs on-demand via the AI Engine.

---

## 6. Search Engine (Section 8)

- **Searchable fields:** job title, keywords (full-text), employer, skills, education, sector, region, city, salary, employment type, experience, publication date, deadline, source.
- **Ethiopian location taxonomy:** 14 regions (Addis Ababa, Oromia, Amhara, Sidama, Tigray, Somali, Afar, Benishangul-Gumuz, Gambela, Central Ethiopia, South Ethiopia, Southwest Ethiopia, Harari, Dire Dawa) plus major cities (Adama, Hawassa, Bahir Dar, Jimma, Mekelle, Shashemene, etc.) and free-form location strings. **Users can select multiple regions.**
- **Preservation rule:** the original location string from the source is always preserved.
- **Multilingual support:** English and Amharic (Ethiopic Unicode) first-class; architecture prepared for Afaan Oromo; translations are never used for job requirements without labeling translated content; original advertisements are always preserved alongside any translation.
- **Paging:** keyset/cursor-based pagination on the backend, consumed via Paging 3 on Android.

---

## 7. Normalization and Deduplication (Section 9)

### 7.1 Unified Job Entity

Every incoming listing normalizes to the canonical Job schema (detailed in [DATABASE_SCHEMA.md](/home/ubuntu/jobhunter-ethiopia/DATABASE_SCHEMA.md)). Fields include title, employer, description, requirements, skills, sector, region, city, employment type, experience level, education level, salary + currency (ETB/USD), publication date, application deadline, discovery/verification dates, original and application URLs, source attribution, and verification/expiration flags.

### 7.2 Deduplication Pipeline

```
Incoming listing
       │
       ▼
1. Exact match: (sourceId, sourceJobId) → update existing record
       │ no match
       ▼
2. Canonical URL match → update
       │ no match
       ▼
3. Fuzzy match: employer name (normalized) + title similarity (token overlap)
   + location region + publication date window (±30 days)
       │ match found
       ▼
   Merge into JobDuplicateCluster; keep multiple source references;
   retain most-complete description; never merge distinct openings
       │ no match
       ▼
4. Insert as new Job
```

### 7.3 Quality Detectors

- **Expired listings:** deadline in the past → status `EXPIRED` (never invent deadlines).
- **Broken links:** periodic HEAD/GET checks; failures flag `LINK_BROKEN`.
- **Duplicate announcements:** detected via the cluster above.
- **Missing information:** flags `MISSING_SALARY`, `MISSING_DEADLINE`, `MISSING_EMPLOYER` (information is **never invented**).
- **Suspicious listings:** forwarded to the scam detection pipeline.
- **Stale listings:** no verification for >60 days → `STALE`.

---

## 8. Android Client Architecture

### 8.1 Screen Inventory (Section 10)

| # | Screen | Purpose |
|---|---|---|
| 1 | **Onboarding** | Welcome, language (English/Amharic), region preferences, consent, AI key policy disclosure |
| 2 | **Home Dashboard** | Featured opportunities, new-today counts, saved-search highlights, application summary, sync status |
| 3 | **Discover Jobs** | Browse all aggregated jobs; sector/region pills; sorting (newest, deadline, match score) |
| 4 | **Search & Filters** | Full-text search with 14 filter dimensions, multiple-region selection, saved searches |
| 5 | **Job Details** | Full description, extracted requirements, match preview, risk flags, apply hand-off, save action |
| 6 | **AI Job Matching** | Decomposed match score, strengths, gaps, disqualifiers, AI reasoning, consent-gated re-analysis |
| 7 | **CV Manager** | PDF/DOCX import, extracted profile review/edit, multiple versions, original file preservation |
| 8 | **Saved Jobs** | Bookmarked listings with offline access, custom notes, deadline badges |
| 9 | **Application Tracker** | 10-status pipeline, dates, CV/cover-letter used, follow-up & interview reminders |
| 10 | **Notifications** | Matching jobs, deadlines, reminders, sync errors; frequency controls |
| 11 | **AI Career Assistant** | Chat, cover letter drafting, interview prep, requirement explainer |
| 12 | **Job Source Management** | Per-source enable/disable, health status, last sync, error log, add employer URL |
| 13 | **Settings & Profile** | Language, regions, notifications, AI provider order, budget, data export/deletion, consent |

**Bottom navigation:** Home · Discover · Saved · Applications · Profile.

### 8.2 Clean Architecture Layers

```
presentation/
  ui/
    home/       dashboard/feed screens, Compose
    discover/   lists, filters, paging
    details/    job detail, apply hand-off
    matching/   match breakdown, explanations
    cv/         CV import, profile editor
    saved/      bookmarks, notes
    tracker/    application state machine
    notifications/  alert list, preferences
    assistant/  chat, cover letters, interview prep
    sources/    source management
    settings/   preferences, consent, export
    navigation/ NavGraph, bottom bar
  viewmodel/    one ViewModel per flow, StateFlow UI state
domain/
  model/        Job, JobMatch, CvProfile, ApplicationRecord, SourceHealth
  repository/   JobRepository, CvRepository, ApplicationRepository, SourceRepository, AiRepository
  usecase/      SearchJobsUseCase, MatchJobUseCase, SyncSourcesUseCase, TrackApplicationUseCase...
data/
  remote/       Retrofit API, DTOs, network interceptors (gzip, cache, auth)
  local/        Room DB (jobs, CVs, applications, sources), DataStore (prefs/consent)
  worker/       SyncWorker, NotificationWorker (WorkManager)
  repository/   Repository implementations combining local + remote
```

### 8.3 Offline and Low-Connectivity Design (Section 14)

1. **Room is the single source of truth for the UI.** Every network fetch writes to Room; the UI observes Room via Flow. Jobs are browsable, searchable, and filterable offline.
2. **WorkManager background sync** runs every 6 hours (configurable) on unmetered or any network per user setting; retries with exponential backoff on failure.
3. **Application tracking and saved jobs work 100% offline;** offline actions sync when connectivity returns.
4. **Transparency:** every job card displays `last_verified_at` and a **"Cached" vs. "Verified"** badge.
5. **Bandwidth discipline:** gzip responses, image-free job cards by default, paginated payloads.
6. **AI is never required** for basic search, saving, or tracking.

### 8.4 Notifications (Section 15)

- Event types: new matching jobs (saved-search match), application deadlines (D-3, D-1), interview reminders (H-24), follow-up reminders, source sync errors.
- WorkManager `NotificationWorker` checks conditions periodically — **no fake "immediate" claims;** cadence matches sync intervals.
- Per-category toggles and frequency controls in Settings; duplicate suppression via a notification-history table.

### 8.5 Application Tracking State Machine (Section 11)

```
INTERESTED ──► SAVED ──► PREPARING ──► APPLIED ──► ASSESSMENT ──► INTERVIEW ──► OFFER
    │                                     │             │            │           ▲
    ▼                                     ▼             ▼            ▼           │
WITHDRAWN                                          REJECTED                    EXPIRED
```

Ten statuses: `INTERESTED, SAVED, PREPARING, APPLIED, ASSESSMENT, INTERVIEW, OFFER, REJECTED, WITHDRAWN, EXPIRED`. Each transition is timestamped and may attach a CV version, cover letter, follow-up date, interview date, and free-form notes. **Hard rule: the app never automatically applies on behalf of the user.**

### 8.6 Scam Detection Pipeline (Section 12)

Heuristic rules run on every ingested job:

| Rule | Signal | Severity |
|---|---|---|
| Upfront fee request | "registration fee", "processing fee", money transfer mentions | High |
| Suspicious email | Free webmail (gmail/yahoo) for a large "corporate" employer | Medium |
| Unverifiable employer | Employer name not in known registry + no website | Medium |
| Unrealistic salary | ETB amounts far outside sector norms | Medium |
| Financial info request | Bank details, ID upload demanded before application | High |
| Suspicious apply link | URL shorteners, mismatches between domain and employer | High |
| Missing company info | No phone, no physical address, no website | Low |

The UI presents an **evidence-based badge with expandable "why" explanations** and a one-tap "Report listing" action. It **never accuses an employer of fraud without evidence.**

---

## 9. Security and Privacy (Section 16)

- All network traffic over **HTTPS/TLS 1.3**.
- Backend JWT authentication with short-lived access tokens and refresh rotation.
- **API keys never in APK:** Groq, NVIDIA, and Mistral keys only in backend environment variables.
- CV files stored server-side with UUID names in a non-public directory; URLs expire.
- **Consent first:** AI processing of CVs requires explicit user consent naming the provider; consent flags stored in DataStore and sync'd to backend.
- Rate limiting on all API routes (per-IP and per-user buckets).
- Privacy-conscious logging: CV text, names, emails redacted from logs.
- User data export (JSON dump) and deletion ("delete my account") endpoints.

---

## 10. Localization Architecture (Section 8)

- String resources split into `strings.xml` (English) and `values-am/strings.xml` (Amharic) with ICU plural rules.
- Amharic UI reviewed for correct Ethiopic Unicode rendering.
- Architecture ready for Afaan Oromo (`values-om`).
- Database and API fully UTF-8.
- **Rule:** machine translation of job content is always labeled, and original content is always preserved alongside translations.

---

## 11. Deployment View

```
[Android User (Ethiopia / intermittent 3G-4G)]
      │ HTTPS
      ▼
[Reverse Proxy / CDN — Nginx + Let's Encrypt]
      │
      ▼
[NestJS API containers (Node 22)]
      ├── Jobs & Adapters
      ├── AI Engine ──► Groq / NVIDIA / Mistral (HTTPS)
      └── Auth & Users
      │
      ▼
[PostgreSQL 16] (Prisma migrations, full-text indexes)
```

The stack deploys via a single `docker-compose.yml` with health checks, automatic restarts, and an `.env.example` defining all required configuration variables.

---

## 12. Non-Functional Requirements Summary

| NFR | Target | Verification |
|---|---|---|
| Offline capability | All cached jobs searchable without network | Manual + instrumentation tests |
| Sync resilience | One failing source never stops others | Unit tests of adapter registry |
| Cold startup | < 2 s to home dashboard | Android Profiler |
| APK size | < 25 MB | Release build report |
| Match score transparency | Every score decomposes into weighted dimensions | ViewModel tests |
| Honesty constraints | Eligibility never claimed with missing data | Unit tests on matching engine |
| Secret safety | No API key strings in APK | APK analysis (`strings`, decompiler) |
| Localization | English + Amharic coverage | Screenshot tests |
