# JobHunter Ethiopia — Job Source Catalog

**Author:** Manus AI
**Date:** November 2026
**Version:** 1.0.0
**Status:** Phase 0 — Research and Feasibility

This catalog documents the empirical investigation of every candidate job source for the JobHunter Ethiopia aggregator. Each source was tested directly between 2026-11-07 14:25 UTC and 14:49 UTC using HTTP probes, robots.txt inspection, sitemap analysis, endpoint discovery, and browser navigation evidence. No integration has been invented; every classification below is grounded in verified behavior.

---

## 1. Classification Taxonomy

| Type | Meaning | Permitted Collection Mode |
|---|---|---|
| **OFFICIAL_API** | Documented, officially supported API | Programmatic API calls with registration/credentials |
| **PUBLIC_FEED** | Public RSS, Atom, JSON, or XML feed | Periodic feed polling with conditional GET |
| **PUBLIC_ATS** | Permitted public employer recruitment endpoint | Public career portal/ATS ingestion |
| **PERMITTED_HTML** | HTML extraction permitted by robots.txt and policy | Polite crawling of permitted public HTML |
| **EXTERNAL_SEARCH** | Opens the original source with prepared search URL | Deep link from the app with pre-filled query |
| **MANUAL_IMPORT** | User adds a vacancy manually (URL, PDF, image) | User-driven import with provenance |
| **UNAVAILABLE** | No reliable or permitted integration | Document reason; do not scrape |

---

## 2. Major Ethiopian Job Portals

### 2.1 Ethiojobs

- **Official URL:** https://ethiojobs.net/ [1]
- **Classification:** **PERMITTED_HTML**
- **Official API:** **None.** No public API documentation or developer program exists. Discovered frontend endpoints under `api.ethiojobs.net/ethiojobs/api/job-board/*` are undocumented internal routes; sampled job/company endpoints returned **HTTP 401 Unauthorized** without credentials and `/api/*` is explicitly disallowed by robots.txt [1].
- **RSS/Atom feeds:** None. Paths `/feed`, `/rss`, and `/rss.xml` each returned HTTP 404 [1].
- **XML endpoints:** `sitemap-jobs.xml` is publicly accessible and lists job detail URLs [1].
- **HTML accessibility:** Fully reachable (HTTP 200). Public `/job/<slug>` pages render title, description, company, deadline, and application instructions server-side; schema.org/JSON-LD metadata is embedded [1].
- **Authentication:** Not required for browsing. Required for applying; some listings use internal ATS direct-apply (`directApply: true`, `application_method: ATS`) [1].
- **Terms of service:** Public terms page with acceptable-use and third-party integration clauses; production crawling should confirm current full terms or obtain permission [1].
- **Robots.txt:** Allows `/` for generic user agents; disallows `/api/*`, `/auth/*`, `/users/*`; references job/company sitemaps [1].
- **Rate limits / reliability:** Good point-in-time reliability via Cloudflare CDN; use conservative rate limits (~1 req/s) with exponential backoff [1].
- **Attribution:** Preserve canonical `ethiojobs.net/job/<slug>` URL and display "Source: Ethiojobs" with logo [1].
- **Application links:** Available. Many listings require Ethiojobs account; JobHunter must hand off users to the canonical URL rather than automate applications [1].
- **Update frequency:** High — dozens of new listings weekly [1].
- **Integration strategy:** Sitemap-led discovery (`sitemap-jobs.xml`) plus polite, rate-limited HTML parsing of `/job/<slug>` with JSON-LD extraction; canonical URL hand-off for applications. If scraping is ever restricted, fall back to EXTERNAL_SEARCH with `site:ethiojobs.net/job/` queries [1].

### 2.2 HaHuJobs

- **Official URL:** https://www.hahu.jobs/ (apex redirects 301 to `www.hahu.jobs`); separate info site at `hahujobs.io` redirects 308 to `www.hahujobs.io` [2]
- **Classification:** **PERMITTED_HTML**
- **Official API:** **None.** No documented public API, open labor-market data API, API-key registration, OAuth developer flow, SDK, or developer program was found [2].
- **RSS/Atom feeds:** None. `/rss.xml`, `/feed`, `/api`, `/api/jobs` returned no feed [2].
- **XML endpoints:** `hahu.jobs/sitemap.xml` returned HTTP 200 without authentication and contained ~10,299 URLs (~899 job-detail URLs in snapshot) [2].
- **HTML accessibility:** Accessible, but job details are client-side JavaScript-rendered (server HTML contains shell only); JS-capable rendering or an approved data interface is required for extraction [2].
- **Undocumented backend:** Frontend config references `graph.cache.hahu.jobs/graphql` with an open GraphQL Playground. **This is an undocumented application backend — never use it without written permission**, per Section 5 vibe-coding rules [2].
- **Telegram bot:** HaHuJobs operates `@hahujobs_bot` and channel `t.me/hahujobs` for vacancy publication, candidate profiling, and applications. This is a user-facing workflow, not a public search API; automated bot access would require operator authorization [2].
- **Authentication:** Public job URLs accessible without login; applications require account/profile [2].
- **Robots.txt:** Empty `Disallow:` directive; points to sitemap.xml [2].
- **Attribution:** Retain `www.hahu.jobs/jobs/...` canonical URLs with HaHuJobs attribution [2].
- **Application links:** Available through site and Telegram [2].
- **Update frequency:** High [2].
- **Integration strategy:** Conservative sitemap discovery + rate-limited JS-rendered HTML extraction; canonical source links; no credential automation. Outreach to MinabTech/HaHuJobs for a documented partner API/feed before production-scale redistribution [2].

### 2.3 GeezJobs

- **Official URL:** https://geezjobs.com/ [3]
- **Classification:** **PERMITTED_HTML**
- **Official API:** **None.** Direct curl probes returned HTTP 403 (Cloudflare/WAF) for the homepage, `/wp-json/wp/v2/posts`, `/feed`, and `/jobs/feed` [3].
- **RSS/Atom feeds:** Not accessible/available [3].
- **XML endpoints:** A detail sitemap is maintained with near-daily updates (modified entries visible 2026-11-07) [3].
- **HTML accessibility:** Accessible via normal browser navigation. Custom server-rendered recruitment platform (not WordPress) exposing public `/job-detail/{slug}` pages with schema.org `JobPosting` JSON-LD (title, description, slug, datePosted, validThrough, employmentType, hiringOrganization, jobLocation, ETB salary range, workHours) [3].
- **Authentication:** Not required for browsing. Quick-apply form at `/job-application/{slug}` accepts name, Ethiopian phone, email, CV PDF/DOCX (<=2 MB), and cover letter [3].
- **Robots.txt:** Allows general public paths; disallows search/CV/admin/mail paths and explicitly disallows `/` for named automated agents (GPTBot, ClaudeBot, CCBot, Bytespider, Applebot-Extended, Amazonbot, meta-externalagent, ev-crawler) [3].
- **Terms of service:** Effective May 10, 2026; governed access without explicit automated scraping permission; written permission recommended for systematic collection [3].
- **Attribution:** Always link to `geezjobs.com/job-detail/{slug}` [3].
- **Application links:** Direct email, internal quick-apply form, occasional external URLs or phone instructions [3].
- **Update frequency:** High — ~168 active vacancies reported at inspection; near-daily sitemap updates [3].
- **Integration strategy:** Browser-grade (or headless) polite sitemap-led HTML/JSON-LD extraction with compliant user-agent identification (never spoofing a banned bot), conservative rate limits, caching, and deadline validation; application links preserved with email/href mismatch detection [3].

### 2.4 EthioNGOJobs

- **Official URL:** https://www.ethiongojobs.com/ [4]
- **Classification:** **PUBLIC_FEED** (the easiest and most reliable integration candidate among the portals)
- **Official API:** Unauthenticated WordPress REST API at `/wp-json/` exposes published posts, rendered HTML, date filters, pagination, and category taxonomy [4].
- **RSS/Atom feeds:** RSS at `/feed/` (declares hourly updates; 10 recent items returned); Atom at `/feed/atom/` [4].
- **HTML accessibility:** Full HTTP 200 across homepage, robots.txt, REST index, feeds, and listings [4].
- **Authentication:** None required for discovery [4].
- **Robots.txt:** `User-agent: *` with empty `Disallow:`; advertises sitemap [4].
- **Terms:** No distinct terms page found at common legal URLs (they return homepage content); JobHunter should preserve attribution, link to originals, minimize full-text redistribution, and request publisher confirmation before large-scale republication [4].
- **Application links:** High quality — listings consistently link out to employer ATS platforms (Workday, CSOD, TAL) and employer sites [4].
- **Update frequency:** Very high — 234 posts since 2026-11-01 [4].
- **Sector focus:** NGO and development-sector heavy, though not exclusively NGO [4].
- **Integration strategy:** **Primary:** hourly RSS polling for incremental discovery. **Enrichment:** WordPress REST API for backfill/date-filtered sync. **Fallback:** polite HTML parsing. This adapter should be built first among portal sources [4].

### 2.5 Ethiopian Reporter Jobs

- **Official URL:** https://www.ethiopianreporterjobs.com/ (bare domain 301 redirects) [5]
- **Classification:** **PUBLIC_FEED**
- **Official API:** None for vacancies. WordPress REST index exists at `/wp-json/`, but no dedicated `/wp-json/wp/v2/job` or `/wp-json/wp/v2/jobs` collection is exposed [5].
- **RSS/Atom feeds:** RSS at `/feed/` returns HTTP 200 application/rss+xml; however, items are mainly editorial/career-advice posts rather than structured vacancies [5].
- **HTML accessibility:** Accessible. Vacancies use numeric URLs like `/jobs/138200/` and expose title, description, requirements, location, salary, contract type, deadline, application emails, phone numbers, and in-person instructions [5].
- **Authentication:** None required for reading [5].
- **Robots.txt:** `Content-Signal: search=yes, ai-train=no, use=reference`; `Allow: /` for generic user agents; disallows named training/scraping agents and protected paths [5].
- **Application links:** Available in broad sense, but often email or physical-office instructions rather than clickable URLs — JobHunter must parse and normalize application methods [5].
- **Freshness:** Site claims daily updates; RSS timestamps can be stale; validate freshness from HTML/sitemap [5].
- **Search URL for fallback:** `https://www.ethiopianreporterjobs.com/?s={query}` and `/jobs-by-employment-types/?search={query}` [5].
- **Integration strategy:** RSS feed for discovery hints + polite HTML extraction from numeric job pages; email/in-person application method parsing; multilingual (Amharic/English) content handling; `?s={query}` EXTERNAL_SEARCH fallback [5].

### 2.6 Ezega Jobs, Etcareers & ICT Jobs Ethiopia

| Dimension | Ezega Jobs [6] | Etcareers [6] | ICT Jobs Ethiopia [6] |
|---|---|---|---|
| URL | https://www.ezega.com/Jobs/ | https://etcareers.com/jobs | https://ictjobs.et/ |
| HTTP status | 200 (browser-like); curl gets 403 | 200; site is **live and not defunct** | 200 |
| Classification | **PERMITTED_HTML** | **PERMITTED_HTML** | **PERMITTED_HTML** |
| Official API | None | None | None (`/api` disallowed) |
| RSS/Atom | `/rss` not usable | None verified | None verified |
| Sitemap | Not advertised | sitemap updated during investigation | `sitemap.xml` + job sitemaps |
| Robots policy | search=yes, ai-train=no, use=reference; Allow / | Blocks sort/page traps & private/apply paths; leaves public job routes crawlable | Allows public pages; disallows /api |
| Apply flow | Direct to employer per instructions | External ATS (e.g. Teamtailor) links | Direct external instruction/link (including Ethiojobs); no job-seeker account needed |
| Update frequency | Moderate | Moderate-high | Moderate |
| Integration | Polite HTML + external search `site:ezega.com/Jobs/` | Sitemap-led HTML; avoid private/apply traps | Sitemap-led HTML; respect `/api` disallow |

**Etcareers availability finding:** Contrary to community speculation, **Etcareers is not defunct** — `etcareers.com` is actively listing jobs with external ATS links and a sitemap updated during the investigation [6].

---

## 3. Government and Public-Sector Sources

| Source | Channel Type | Access Method | Classification | Integration Plan |
|---|---|---|---|---|
| **PSCAMS (Federal Civil Service Commission)** — `pscams.ecsc.gov.et` | Official portal | Public browsing; Register/Login required for candidate actions; no public vacancy API/RSS | **PERMITTED_HTML / EXTERNAL_SEARCH** | Selective adapter for Featured Jobs public listing; deep-link portal for applications; never automate login |
| **Addis Zemen / EPA** — `press.et`, `epa.gov.et` | Newspaper + e-paper portal | Public e-paper/announcement pages (error-prone); PDFs; social reposts | **MANUAL_IMPORT** (primary) + selective adapter | User-submitted PDF/image import with OCR pipeline; monitored announcements where stable |
| **Regional Civil Service Portals** (Oromia, Amhara, Sidama, Tigray, Somali, etc.) | Regional portals & bureau channels | Decentralized: Amhara official portal advertises job matching; Oromia fragmented across bureaus; others no unified portal verified | **EXTERNAL_SEARCH / MANUAL_IMPORT** | Curated regional search URLs; user vacancy submission per region |
| **Federal Ministry Career Pages** (Health, Justice, Labor & Skills, etc.) | Official ministry websites | Mixed: HTML job boards, announcements, PDFs; email/in-person instructions | **PERMITTED_HTML** (where stable) / **MANUAL_IMPORT** | Per-ministry adapters for stable job boards (Health, Justice, Labor & Skills multilingual); manual import for PDFs |
| **Public Universities** (Addis Ababa University, ASTU, Hawassa, Bahir Dar, Jimma, Mekelle) | Official announcement systems & PDFs | Public announcement pages; e.g. AAU announcements system | **EXTERNAL_SEARCH / MANUAL_IMPORT** | Curated directory + user vacancy submission + OCR |
| **State-Owned Enterprises — Ethiopian Airlines** | Official career portal | Public vacancies page with positions, dates, qualifications, application instructions (links/email/HR office) | **PERMITTED_HTML / EXTERNAL_SEARCH** | Strong adapter candidate (stable public structure); external apply hand-off |
| **State-Owned Enterprises — Commercial Bank of Ethiopia** | Official careers page + `vacancy.cbe.com.et` | Official vacancy PDFs; separate application portal; Telegram guidance | **EXTERNAL_SEARCH / MANUAL_IMPORT** | Curated links + PDF import; do not automate CBE portal |
| **State-Owned Enterprises — Ethio Telecom** | Official site (`ethiotelecom.et`) | Vacancy entry point exists; eCare shell less transparent | **EXTERNAL_SEARCH** | Curated link to official vacancy page until public structure maps cleanly |

**General rule for government sources [7]:** No documented vacancy-specific API or authoritative public RSS feed was confirmed across the reviewed government sources. Application submission must never be automated. The app should surface opportunities, parse eligibility/deadlines, and hand off users to official channels with clear provenance.

---

## 4. NGOs and UN/International Organizations

| Source | Official API | Feed | Portal Type | Classification | Integration Plan |
|---|---|---|---|---|---|
| **ReliefWeb** (UN OCHA) — `api.reliefweb.int/v1|v2/jobs` | **v2 official JSON API** (requires pre-approved appname registration; 1,000 items/call, 1,000 calls/day; retain source IP rights). v1 is **HTTP 410 Gone** | — | — | **OFFICIAL_API** | Register appname; query Ethiopia jobs (`parameters[iso3]=ETH`); richest official NGO vacancy feed available |
| **WHO / Stellis** — `who.int/careers` | — | **Official RSS** for external-candidate and internship openings | Stellis recruitment | **PUBLIC_FEED** | First-party RSS integration; direct application hand-off |
| **UNDP** — `jobs.undp.org` | — | — | Oracle Cloud Candidate Experience | **PUBLIC_ATS** | Public ATS monitoring where compliant; EXTERNAL_SEARCH fallback |
| **UNICEF** — `jobs.unicef.org` | — | — | Online recruitment profile | **PUBLIC_ATS** | EXTERNAL_SEARCH + manual import |
| **World Bank Group & AfDB** | — | — | Official vacancy pages; AfDB splits vacancies/consultants/internships/YPP | **PUBLIC_ATS** | EXTERNAL_SEARCH + manual import |
| **International NGOs** (IRC, Save the Children, World Vision, Oxfam, CARE) | — | — | Workday (IRC, World Vision — JS-loaded public search), Taleo, Greenhouse, affiliate portals | **PUBLIC_ATS** | Public ATS monitoring per affiliate; **coverage caveat: Save the Children national country-office roles may not appear on the international portal** — country-office channels need separate tracking |
| **CCRDA (local Ethiopian NGO network)** — `ccrdaeth.org` | — | — | 500+ member network; vacancies via social posts/email | **MANUAL_IMPORT / EXTERNAL_SEARCH** | Curated directory; social-post import with employer verification |

**ReliefWeb finding [8]:** ReliefWeb v2 is the single strongest official aggregation candidate — Ethiopia-filtered humanitarian jobs returned as structured JSON once an appname is approved.

---

## 5. University and Graduate Opportunities

| Channel | Format | Classification | JobHunter Handling |
|---|---|---|---|
| Public university career services (AAU, ASTU — Adama, Hawassa, Bahir Dar, Jimma, Mekelle) | Announcement pages, notice boards, job fairs, PDFs | **MANUAL_IMPORT / EXTERNAL_SEARCH** | Curated external links, saved searches, user-submitted URL/PDF/screenshot import with OCR |
| Bank graduate trainee programs (CBE, Awash, Dashen) | Employer career pages / SAP SuccessFactors / accounts | **EXTERNAL_SEARCH / MANUAL_IMPORT** | Curated program pages, recurring campaign alerts, hand-off to official systems |
| Ethio Telecom & Ethiopian Airlines trainee programs | Official career pages + reposts | **EXTERNAL_SEARCH / MANUAL_IMPORT** | Official-vs-repost provenance labels; recurring alerts |
| Internship calls (NGO/UN/government/universities) | Distributed: Jimma jobs page has "internship" type; Hawassa/Bahir Dar career centers & job fairs; UN/NGO sites | **MIXED** | ReliefWeb internships via API; WHO internship RSS; curated search queries |
| Research assistant positions (EPHI bids-and-vacancy, EIAR research centers, university project pages) | Mixed announcements | **MANUAL_IMPORT / EXTERNAL_SEARCH** | Curated links + user submissions; research-specific fields |

**Correction noted during research [9]:** `astu.edu.et` is **Adama** Science and Technology University, not Addis Ababa Science and Technology University — the institution/domain mapping has been corrected in the catalog.

---

## 6. Adapter Roadmap and Priorities

Based on feasibility, legal cleanliness, and market relevance, adapters should be built in this order:

| Phase | Source | Type | Reason |
|---|---|---|---|
| **P1** | EthioNGOJobs | PUBLIC_FEED | Unauthenticated RSS + WP REST; 234 posts/week; highest clean-data ROI |
| **P1** | ReliefWeb v2 (Ethiopia) | OFFICIAL_API | Official UN OCHA JSON API; structured; humanitarian sector coverage |
| **P1** | WHO Stellis | PUBLIC_FEED | First-party RSS for external candidates & internships |
| **P1** | Ethiopian Reporter Jobs | PUBLIC_FEED + HTML | Mixed RSS for discovery + HTML parsing; `?s={query}` search fallback |
| **P2** | Ethiojobs | PERMITTED_HTML | Largest portal; sitemap discovery; robots-compliant HTML parsing |
| **P2** | Etcareers | PERMITTED_HTML | Live, clean public HTML with ATS links |
| **P2** | ICT Jobs Ethiopia | PERMITTED_HTML | ICT-specialized; public HTML + sitemaps; direct-to-employer |
| **P2** | GeezJobs | PERMITTED_HTML | JSON-LD available; browser-grade fetch needed (403 to raw curl) |
| **P2** | HaHuJobs | PERMITTED_HTML | Sitemap discovery + JS-rendered extraction; explore partner API |
| **P3** | Ethiopian Airlines & CBE | PUBLIC_ATS / EXTERNAL_SEARCH | High-profile employers; stable public structure |
| **P3** | PSCAMS (Civil Service) | PERMITTED_HTML / EXTERNAL_SEARCH | Federal civil service; Featured Jobs adapter |
| **P3** | Ministries (Health, Justice, Labor & Skills) | PERMITTED_HTML | Stable public job boards |
| All | All other government, UN, NGO, university sources | EXTERNAL_SEARCH / MANUAL_IMPORT | Curated deep-link directory + user import + OCR |

---

## 7. Universal Adapter Rules (from Section 5 and Section 18)

1. Never bypass authentication, CAPTCHAs, anti-bot controls, or website restrictions.
2. Never fabricate an API or pretend an integration works.
3. Every adapter implements the common contract: `searchJobs()`, `getJobDetails()`, `fetchNextPage()`, `normalizeJob()`, `validateJob()`, `getSourceHealth()`, `getLastSyncTime()`, `handleRateLimit()`, `reportSourceError()`.
4. All records normalize into the unified Job entity (Section 9); deduplication preserves multiple source references.
5. One failing source must never stop the entire aggregator; track per-source health, errors, job counts, and sync timestamps.
6. When a source cannot be integrated, document the reason and provide an EXTERNAL_SEARCH alternative.
7. Application submission is never automated; JobHunter hands off to the canonical source URL.
8. Every listed job displays source attribution and last-verified timestamp.
9. Distinguish cached information from currently verified information in the UI.

---

## References

[1]: https://ethiojobs.net/ "Ethiojobs — Ethiopian job portal homepage, robots.txt, sitemaps and public job pages"
[2]: https://www.hahu.jobs/ "HaHuJobs — Ethiopian employment platform homepage, robots.txt and sitemap"
[3]: https://geezjobs.com/ "GeezJobs — Ethiopian job portal homepage, robots.txt, sitemaps and JobPosting JSON-LD"
[4]: https://www.ethiongojobs.com/ "EthioNGOJobs — NGO job portal homepage, RSS feed and WordPress REST API"
[5]: https://www.ethiopianreporterjobs.com/ "Ethiopian Reporter Jobs — vacancy portal homepage, robots.txt, RSS feed and search"
[6]: https://www.ezega.com/Jobs/ "Ezega Jobs portal; Etcareers live jobs index at etcareers.com/jobs; ICT Jobs Ethiopia at ictjobs.et"
[7]: https://pscams.ecsc.gov.et/ "Ethiopian Public Service Commission PSCAMS portal, EPA/press.et, ministry and state-owned enterprise career pages"
[8]: https://api.reliefweb.int/v2/jobs "ReliefWeb API v2 documentation and job endpoints; WHO Stellis careers at who.int/careers"
[9]: https://www.aau.edu.et/ "Ethiopian public university vacancy pages, graduate trainee programs and national internship channels"
