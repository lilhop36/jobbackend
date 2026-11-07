# JobHunter Ethiopia — Implementation Roadmap

**Author:** Manus AI
**Date:** November 2026
**Version:** 1.0.0
**Status:** Phase 0 — Research and Feasibility

This roadmap translates the Phase 0 findings into an execution plan for Phases 1–8 of the product specification. Estimates assume a single developer working with AI coding tools, following the vibe-coding rules in Section 18 (small verifiable phases, tests after each major implementation, no invented APIs, no exposed credentials).

---

## 1. Phase Overview

| Phase | Name | Target Duration | Key Deliverable | Exit Gate |
|---|---|---|---|---|
| **0** | Research and feasibility | Complete | 5 docs: source catalog, AI catalog, architecture, schema, roadmap | Honest, evidence-backed catalogs published |
| **1** | Android foundation | 2–3 weeks | Scaffolded Compose app with navigation, design system, Room DB, preferences, basic screens | App compiles, 5-tab navigation works, dark/light themes |
| **2** | Job aggregation (backend) | 2 weeks | NestJS backend, adapter framework, first 4 adapters, deduplication | `npm test` passes; 4 sources sync real data |
| **3** | Job discovery | 2 weeks | Full search, 14 filters, paging, job details, external apply links | Filtered search returns verified results; deeplinks work |
| **4** | Personal job management | 1.5 weeks | Saved jobs, 10-status application tracker, notes, reminders | Offline CRUD + sync tested |
| **5** | AI integration | 2.5 weeks | Groq + NVIDIA + Mistral adapters, CV extraction, match scoring, cover letters, chat | Provider fallback works; consent gate verified; AI keys never in APK |
| **6** | Notifications & offline | 1.5 weeks | WorkManager sync, 5 alert types, cached-vs-verified UI, retry queue | Offline browsing + delayed notifications verified |
| **7** | Quality & security | 2 weeks | Test suite (unit, integration, adapter, UI), security review, performance audit | All tests green; APK < 25 MB; no keys in APK |
| **8** | Release | 1 week | Signed release APK, README, install guides, deployment docs | Acceptance criteria 100% met |

**Total estimated timeline: 12–15 weeks** (phases 1 and 2 can partially overlap).

---

## 2. Work Breakdown Structure

### Phase 0 — Research and Feasibility (Complete)

- [x] Web-probe 8 Ethiopian job portals; document accessibility, robots policy, feeds, APIs
- [x] Investigate government recruitment channels (PSCAMS, Addis Zemen, regional, SOEs)
- [x] Investigate NGO/UN recruitment (ReliefWeb v2 JSON API discovered — major finding; WHO RSS; ATS portals)
- [x] Investigate university & graduate channels (AAU, ASTU, Hawassa, Bahir Dar, Jimma, Mekelle)
- [x] Investigate NVIDIA, Groq, and Mistral APIs (models, pricing, limits, SDK compatibility)
- [x] Produce JOB_SOURCE_CATALOG.md, AI_PROVIDER_CATALOG.md, PROJECT_ARCHITECTURE.md, DATABASE_SCHEMA.md, IMPLEMENTATION_ROADMAP.md

### Phase 1 — Android Foundation

- [ ] Android Studio Gradle project with Kotlin DSL, version catalog, Hilt, Room, Retrofit, Navigation Compose, DataStore, Paging 3
- [ ] Material 3 theme (light + dark), Ethiopian-inspired professional color system, typography supporting Ethiopic script
- [ ] Room database with the 7 cache entities and DAOs (Section 3 of DATABASE_SCHEMA)
- [ ] DataStore repository for language, region preferences, consent flags, AI budget
- [ ] Navigation shell: 5-tab bottom navigation (Home, Discover, Saved, Applications, Profile) + nested NavGraphs
- [ ] Skeleton screens for all 13 screens with loading/empty/error states
- [ ] Language selection (English / Amharic) wired to `values-am/strings.xml`

### Phase 2 — Job Aggregation

- [ ] NestJS project scaffold with Prisma 6 + PostgreSQL (SQLite for local dev/testing)
- [ ] `JobSourceAdapter` interface, adapter registry with health/error/rate-limit tracking
- [ ] **P1 adapters (real sources):**
  - EthioNGOJobs — RSS polling + WordPress REST enrichment (highest ROI)
  - ReliefWeb v2 — official JSON API with Ethiopia filter (requires appname registration)
  - WHO Stellis — official vacancy RSS feed
  - Ethiopian Reporter Jobs — RSS hints + polite HTML extraction
- [ ] Normalizer mapping raw source fields → unified Job entity (nulls for missing data, never invented)
- [ ] Deduplication pipeline (exact source-id, canonical URL, fuzzy employer+title) with `JobDuplicateCluster`
- [ ] Quality detectors: expired listings, broken links, missing-information flags, scam heuristics
- [ ] Source attribution preserved and exposed via REST API (`/api/jobs`, `/api/jobs/:id`, `/api/sources`)

### Phase 3 — Job Discovery

- [ ] Search API with full-text + 14 filters (title, employer, skills, education, sector, region, city, salary, employment type, experience, date, deadline, source)
- [ ] Multiple-region selection; 14 Ethiopian regions + cities taxonomy
- [ ] Android search screen with chip filters, saved searches, debounced search
- [ ] Discover screen with Paging 3 infinite scroll, sort by newest / deadline / match
- [ ] Job details screen: full description, extracted requirements, risk badges, original/apply URLs, "Save" action, cached-vs-verified badge
- [ ] Canonical URL hand-off with intent chooser; in-person/email application method display

### Phase 4 — Personal Job Management

- [ ] Saved jobs with offline bookmarks and per-job notes
- [ ] Application tracker with 10 statuses (`INTERESTED` → `OFFER` / `REJECTED`), applied-at dates, CV version tags, cover letters, follow-up & interview dates
- [ ] Manual application tracking (user-entered vacancies)
- [ ] Reminders for follow-ups and interviews
- [ ] Offline write queue (`PendingSyncAction`) with retry on reconnect
- [ ] Data export (JSON) and delete-account flows

### Phase 5 — AI Integration

- [ ] Backend AI Engine with `AiProvider` interface
- [ ] **GroqAdapter** — `llama-3.3-70b-versatile` (chat, cover letters, matching), `llama-3.1-8b-instant` (classification)
- [ ] **NVIDIAAdapter** — `meta/llama-3.3-70b-instruct` (job extraction), `nvidia/nemotron-3-super-120b` (scam analysis, reasoning)
- [ ] **MistralAdapter** — `mistral-ocr-latest` (PDF CV extraction), `mistral-large-latest` (multilingual reasoning) — requires billing activation
- [ ] Provider selection order (Groq → NVIDIA → Mistral), 5-minute health probes, circuit breaker
- [ ] Consent gate: explain provider to user before sending CV data; consent stored and synced
- [ ] Deterministic fallbacks for every AI feature (matching rule-based score, cover letter templates, keyword classification) — app fully functional with zero AI
- [ ] CV manager: PDF/DOCX import (pdf-parse / mammoth), extracted profile review/edit UI, original file preserved
- [ ] Transparent match scoring UI: dimension breakdown, strong matches, missing requirements, disqualifiers, non-probability disclaimer
- [ ] Cover letter generator + interview prep + scam risk explanations
- [ ] Token/cost telemetry and per-user daily budget; caching by content hash
- [ ] Security verification: no API keys inside APK; CV content redacted from logs

### Phase 6 — Notifications and Offline Support

- [ ] WorkManager `SyncWorker` (periodic source sync, 6-hour default) and `NotificationWorker`
- [ ] 5 notification types: new matching jobs, deadline warnings (D-3, D-1), interview reminders (H-24), follow-ups, sync errors
- [ ] Notification frequency controls; duplicate suppression via `dedupeKey`
- [ ] Room as single source of truth; offline browsing and search
- [ ] "Cached" vs. "Verified" badges with `last_verified_at`
- [ ] Gzip compression, paginated payloads

### Phase 7 — Quality and Security

- [ ] Unit tests: adapters (mock responses), normalizer, deduplication, match scoring, scam heuristics, ViewModels
- [ ] Integration tests: sync pipeline, Prisma repository, REST API endpoints
- [ ] Provider tests: Groq, NVIDIA, Mistral adapters against live sandbox endpoints with test keys
- [ ] UI tests (Compose): onboarding, discover, job details, application tracker, matching screen
- [ ] Security audit: API keys absent from APK; HTTPS enforcement; input validation; CV upload validation; consent enforcement
- [ ] Performance audit: startup < 2 s, APK < 25 MB, Paging memory budget

### Phase 8 — Release

- [ ] Release signing keystore, ProGuard/R8 rules, release APK build
- [ ] README.md with architecture overview and screenshots
- [ ] INSTALLATION.md (Android build instructions)
- [ ] BACKEND_DEPLOYMENT.md (Docker Compose, Prisma migrations, cron workers)
- [ ] API_CONFIGURATION.md (.env variables for Groq, NVIDIA, Mistral keys)
- [ ] SOURCE_INTEGRATION.md (how to add/verify new adapters)
- [ ] Acceptance criteria verification checklist (all 15 items)

---

## 3. Adapter Delivery Order

| Wave | Source | Type | Est. Effort |
|---|---|---|---|
| Wave 1 | EthioNGOJobs | PUBLIC_FEED (RSS + WP REST) | 2 days |
| Wave 1 | ReliefWeb v2 Ethiopia | OFFICIAL_API | 2 days (incl. appname registration) |
| Wave 1 | WHO Stellis | PUBLIC_FEED (RSS) | 1 day |
| Wave 1 | Ethiopian Reporter Jobs | PUBLIC_FEED + HTML | 2 days |
| Wave 2 | Ethiojobs | PERMITTED_HTML (sitemap-led) | 3 days |
| Wave 2 | Etcareers | PERMITTED_HTML | 2 days |
| Wave 2 | ICT Jobs Ethiopia | PERMITTED_HTML | 2 days |
| Wave 2 | GeezJobs | PERMITTED_HTML (browser-grade fetch) | 3 days |
| Wave 2 | HaHuJobs | PERMITTED_HTML (JS-rendered) + outreach | 3 days |
| Wave 3 | Ethiopian Airlines, CBE, PSCAMS Featured Jobs | PUBLIC_ATS / HTML | 4 days |
| All waves | Government/university/NGO channels without adapters | EXTERNAL_SEARCH + MANUAL_IMPORT + OCR | ongoing |

---

## 4. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A source blocks automated requests (WAF/403) | High | Medium | Fall back to EXTERNAL_SEARCH with deep links; document reason; never bypass anti-bot controls |
| AI provider rate limits or billing issues | Medium | Medium | Three-provider fallback chain; deterministic non-AI fallbacks for all features; budget telemetry |
| Mistral free tier lacks API access | Certain | Low | Use Groq + NVIDIA; activate Mistral billing only when OCR/multilingual value justifies it |
| Addis Zemen remains print/PDF-dominated | High | Medium | MANUAL_IMPORT pipeline with OCR; do not claim a non-existent feed |
| Client-rendered sources (HaHuJobs, Workday) resist simple parsing | Medium | Medium | Headless rendering or official outreach; keep canonical links |
| Connectivity disruptions during sync in Ethiopia | High | Medium | WorkManager exponential backoff; Room cache as UI source of truth; sync status transparency |
| Duplicate vacancies across aggregators | High | Low | Multi-stage deduplication preserving all source references |
| Misleading scam warnings | Medium | High | Evidence-based explanations only; never accuse without proof; user report flow |
| APK size growth from libraries | Medium | Low | Paging 3, R8 shrinking, image-free defaults, target < 25 MB |

---

## 5. Acceptance Criteria Traceability Matrix

Every acceptance criterion from Section 19 maps to a phase:

| Acceptance Criterion | Phase | Test / Evidence |
|---|---|---|
| Android app builds successfully | 1, 8 | `./gradlew assembleRelease` exit 0 |
| Usable native interface (13 screens, Compose, M3) | 1, 3, 4 | UI screenshot tests + manual walkthrough |
| Multiple verified Ethiopian job sources work | 2 | Adapter integration tests with real fetched data |
| Normalized job schema for all records | 2 | Schema validation tests on every adapter output |
| Duplicate listings controlled | 2 | Deduplication unit tests (exact + fuzzy cases) |
| Search and filters work (14 dimensions) | 3 | Search query tests + multi-region filter tests |
| Users can save jobs | 4 | Saved jobs CRUD + offline tests |
| Users can track applications (10 statuses) | 4 | State-machine transition tests |
| Users can import and manage CVs | 5 | PDF/DOCX parsing tests + editor UI tests |
| AI matching works with configured providers | 5 | Provider adapter tests (Groq/NVIDIA/Mistral) |
| Provider failures handled gracefully | 5 | Fault-injection tests (429, timeout, 5xx) → fallback verified |
| API keys remain secure | 5, 7 | APK binary analysis (`strings`, APKTool) finds no key |
| Offline functionality works | 6 | Airplane-mode test scenarios documented |
| Notifications without duplicate spam | 6 | Notification deduplication tests |
| Source attribution is visible | 3 | Every job card verified to show source + verified date |
| Automated tests pass | 7 | Full CI suite green |
| Release APK installable and usable | 8 | Sideload test on physical/emulator device |

---

## 6. Definition of Done (per phase)

A phase is complete only when: (1) code committed with meaningful messages, (2) automated tests written and passing, (3) documentation updated, (4) acceptance criteria evidence recorded. No completion claims without test evidence (vibe-coding rule 13).
