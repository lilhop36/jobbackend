# JobHunter Ethiopia

**All Ethiopian jobs in one place — honest match scores, offline access, real sources only.**

A complete, production-grade job aggregation and career assistant platform for Ethiopia, consisting of:

- **Kotlin Jetpack Compose Android app** (Material 3, offline-first Room cache, 5-tab bottom navigation, 13 screens, Ethiopian-inspired visual identity)
- **Node.js / Express backend** (Prisma 6 ORM, SQLite dev DB, multi-source sync engine, deduplication, honest match scoring, scam detection, AI career assistant)
- **Verified Ethiopian job source catalog** with evidence per source (EthioNGOJobs, ReliefWeb, WHO Stellis, Ethiopian Reporter Jobs, Ethiojobs, HahuJobs, Dereja, and more)
- **AI provider catalog** (NVIDIA NIM, Groq, Mistral) with cost-optimized task allocations and fallback chain

Render deployment configuration and free-tier limitations are documented in [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md). The root `render.yaml` provisions a Node web service plus PostgreSQL and runs Prisma migrations before deploy.

## Repository Layout

```
jobhunter-ethiopia/
├── docs/                        # Phase 0 deliverables
│   ├── JOB_SOURCE_CATALOG.md
│   ├── AI_PROVIDER_CATALOG.md
│   ├── PROJECT_ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   └── IMPLEMENTATION_ROADMAP.md
├── backend/                     # Node.js + TypeScript REST API
│   ├── prisma/schema.prisma     # Unified Job entity + Room-mirrored models
│   ├── src/adapters/            # Source-isolated adapters
│   ├── src/deduplicator/        # Exact + canonical URL + fuzzy deduplication
│   ├── src/matching/            # Transparent 8-dimension match scoring
│   ├── src/scam/                # Evidence-based scam detection
│   ├── src/ai/                  # Provider-independent AI engine
│   ├── src/search/              # 14-filter search engine
│   └── tests/                   # 29 unit tests (Vitest)
├── android/                     # Kotlin Jetpack Compose app
│   └── app/                     # 13 screens, Room, Retrofit, WorkManager
└── jobhunter-ethiopia-release.apk  # Signed release APK (2.56 MB)
```

## Quick Start — Backend

```bash
cd backend
pnpm install
pnpm prisma:generate:sqlite
pnpm prisma:push
pnpm test                          # 29 tests, all passing
pnpm build && node dist/src/main.js # API on http://localhost:3000
```

Verify with a live sync of real Ethiopian vacancies:

```bash
npx tsx src/sync/runSync.ts ethiongojobs
```

Optional: configure AI keys in `backend/.env` for real Groq/NVIDIA/Mistral responses (the app degrades gracefully without keys):

```properties
AI_PRIMARY_PROVIDER=groq
GROQ_API_KEY=gsk_...
NVIDIA_API_KEY=nvapi-...
MISTRAL_API_KEY=...
```

## Quick Start — Android App

Pre-requisites: JDK 17+, Android SDK (API 34/35), `ANDROID_HOME` set.

```bash
cd android
./gradlew testDebugUnitTest   # run repository unit tests
./gradlew assembleDebug       # debug APK with .debug applicationId
./gradlew assembleRelease     # signed release APK with R8 minification
```

Or install the already-built signed release APK:

```bash
adb install jobhunter-ethiopia-release.apk
```

The APK is **2.56 MB** (well under the 15 MB budget) and uses Ethiopian-flag-inspired colors (forest green, gold, terracotta) with Material 3 theming.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Service health + source health summary |
| GET | `/api/meta/regions` | 14 Ethiopian regions + major cities |
| GET | `/api/sources` | Source registry health + toggle state |
| POST | `/api/sources/sync` | Trigger sync (all or per-source) |
| GET | `/api/jobs` | Search with 14 filters, regions, sectors |
| GET | `/api/jobs/:id` | Job detail with risk flags |
| POST | `/api/cv` | Save CV profile |
| POST | `/api/match` | Decomposed 0-100 fit score + honesty rules |
| POST | `/api/cover-letter` | Grounded cover letter |
| POST | `/api/interview-prep` | Role-specific interview questions |
| POST | `/api/scam-check/:id` | Listing risk flags with "why" explanations |
| POST | `/api/assistant/chat` | AI assistant with deterministic fallback |
| GET/POST/PATCH | `/api/applications` | 10-status application tracker |
| GET/POST/DELETE | `/api/saved` | Bookmarked jobs |

## Ethiopian Region Coverage (14 regions per spec Section 8)

Addis Ababa, Oromia, Amhara, Sidama, Tigray, Somali, Afar, Benishangul-Gumuz, Gambela, Central Ethiopia, South Ethiopia, Southwest Ethiopia, Harari, Dire Dawa.

## Guarantees

1. **No fake jobs ever** — every listing comes from a verified source with source attribution and a working original URL
2. **Honest match scores** — automated compatibility estimate decomposed into 8 dimensions with missing/unknown requirements explicitly shown; never a probability of employment
3. **Evidence-based scam warnings** — every flag includes the reason and evidence
4. **Offline-first** — cached listings are always available with "Cached" badges and last-verified timestamps
5. **Privacy** — AI provider keys never touch the app; CV processing is server-side and consent-gated
