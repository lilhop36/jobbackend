# JobHunter Ethiopia — Database Schema

**Author:** Manus AI
**Date:** November 2026
**Version:** 1.0.0
**Status:** Phase 0 — Research and Feasibility

This document defines the data model for the JobHunter Ethiopia backend (PostgreSQL via **Prisma 6**) and the Android client cache (**Room**). Both layers implement the unified Job entity and deduplication rules mandated by Section 9 of the product specification.

---

## 1. Entity-Relationship Overview

```
                      ┌───────────────┐
                      │    Source     │
                      └───────┬───────┘
                              │ 1
                              │
                              ▼ *
┌─────────────┐       ┌───────────────┐        ┌─────────────────────┐
│    User     │──1:N──│ Application   │──N:1───│        Job          │
└──────┬──────┘       │    Record     │        └──────────┬──────────┘
       │              └───────────────┘                   │ 1
       │ 1:N                                              ▼ *
       ▼                                       ┌─────────────────────┐
┌─────────────┐                                │ JobSourceReference  │
│  CvProfile  │                                └─────────────────────┘
└─────────────┘                                           ▲ *
       │ 1:N                                              │
       ├────────► CvEducation                  ┌──────────┴──────────┐
       ├────────► CvExperience                 │ JobDuplicateCluster │
       └────────► CvSkill                      └─────────────────────┘
```

---

## 2. Prisma Schema (PostgreSQL)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ─────────────────────────────────────────────
// Sources & Aggregation
// ─────────────────────────────────────────────

enum SourceType {
  OFFICIAL_API
  PUBLIC_FEED
  PUBLIC_ATS
  PERMITTED_HTML
  EXTERNAL_SEARCH
  MANUAL_IMPORT
  UNAVAILABLE
}

enum SyncStatus {
  SUCCESS
  PARTIAL
  FAILED
}

model Source {
  id             String          @id                 // e.g. "ethiojobs", "reliefweb_ethiopia"
  name           String
  type           SourceType
  baseUrl        String
  enabled        Boolean         @default(true)
  pollIntervalMin Int            @default(360)        // minutes between syncs
  lastSyncAt     DateTime?
  lastSyncStatus SyncStatus?
  jobCount       Int             @default(0)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  jobs           JobSourceReference[]
  syncLogs       SourceSyncLog[]
}

model SourceSyncLog {
  id           String     @id @default(uuid())
  sourceId     String
  status       SyncStatus
  itemsFetched Int        @default(0)
  itemsAdded   Int        @default(0)
  itemsUpdated Int        @default(0)
  durationMs   Int        @default(0)
  errorMessage String?
  startedAt    DateTime   @default(now())

  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@index([sourceId, startedAt])
}

// ─────────────────────────────────────────────
// Jobs (Unified Entity — Section 9)
// ─────────────────────────────────────────────

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERNSHIP
  VOLUNTEER
  TEMPORARY
  OTHER
}

enum EducationLevel {
  GRADE_10_12
  TVET
  DIPLOMA
  BACHELOR
  MASTER
  PHD
  CERTIFICATION
  EXPERIENCE_ONLY
  NOT_SPECIFIED
}

enum VerificationStatus {
  VERIFIED
  UNVERIFIED
  CLAIMED_BY_EMPLOYER
}

enum ExpirationStatus {
  ACTIVE
  EXPIRED
  STALE
  LINK_BROKEN
}

model Job {
  id               String              @id @default(uuid())
  title            String
  employer         String
  employerWebsite  String?
  description      String              @db.Text
  descriptionPlain String?             @db.Text        // stripped for search
  requirements     Json?                               // extracted requirements {education, experienceYears, requiredSkills[], preferredSkills[], certifications[], languages[], eligibilityCriteria[]}
  skills           String[]                            // normalized skill tags
  sector           String                              // e.g. "ICT", "NGO", "Health", "Finance"
  region           String                              // e.g. "Addis Ababa", "Oromia", "Amhara"
  city             String?
  locationRaw      String                              // ALWAYS preserve original location string
  employmentType   EmploymentType      @default(FULL_TIME)
  experienceLevel  String?                             // e.g. "0-2 years", "5+ years"
  educationLevel   EducationLevel      @default(NOT_SPECIFIED)
  salaryMin        Decimal?            @db.Decimal(12,2)
  salaryMax        Decimal?            @db.Decimal(12,2)
  currency         String              @default("ETB")
  salaryRaw        String?                             // verbatim original salary text
  publishedAt      DateTime?
  deadline         DateTime?
  firstDiscoveredAt DateTime          @default(now())
  lastVerifiedAt   DateTime            @default(now())
  originalUrl      String              @db.Text
  applicationUrl   String?             @db.Text
  applicationMethod String?                            // "URL" | "EMAIL" | "PHONE" | "IN_PERSON" | "PORTAL"
  applicationInstructions String?      @db.Text
  sourceAttribution String                             // e.g. "Ethiojobs"
  verificationStatus VerificationStatus @default(UNVERIFIED)
  expirationStatus   ExpirationStatus   @default(ACTIVE)

  clusterId        String?
  cluster          JobDuplicateCluster? @relation(fields: [clusterId], references: [id], onDelete: SetNull)

  sourceReferences JobSourceReference[]
  riskFlags        RiskFlag[]
  applications     ApplicationRecord[]
  savedBy          SavedJob[]
  matches          JobMatchCache[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([region])
  @@index([sector])
  @@index([educationLevel])
  @@index([deadline])
  @@index([publishedAt])
  @@index([lastVerifiedAt])
  @@index([expirationStatus])
  @@index([employer])
  @@index([sourceAttribution])
}

model JobSourceReference {
  id         String   @id @default(uuid())
  jobId      String
  sourceId   String
  sourceJobId String?                                // ID assigned by the source
  url        String   @db.Text
  fetchedAt  DateTime @default(now())

  job    Job    @relation(fields: [jobId], references: [id], onDelete: Cascade)
  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@unique([sourceId, sourceJobId])
  @@index([jobId])
}

model JobDuplicateCluster {
  id          String   @id @default(uuid())
  canonicalId String?                                // preferred canonical job id
  reason      String                                 // e.g. "url_match" | "fuzzy_employer_title"
  confidence  Decimal  @db.Decimal(3,2)              // 0.00 - 1.00
  createdAt   DateTime @default(now())

  jobs Job[]
}

// ─────────────────────────────────────────────
// Risk & Trust (Section 12)
// ─────────────────────────────────────────────

enum RiskSeverity {
  LOW
  MEDIUM
  HIGH
}

model RiskFlag {
  id        String       @id @default(uuid())
  jobId     String
  code      String                                   // e.g. "UPFRONT_FEE", "SUSPICIOUS_EMAIL"
  severity  RiskSeverity
  reason    String       @db.Text                    // every flag MUST explain why
  evidence  String?      @db.Text
  createdAt DateTime     @default(now())

  job Job @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
}

model UserReport {
  id        String   @id @default(uuid())
  jobId     String
  userId    String?
  category  String                                   // "scam" | "expired" | "incorrect_info" | "duplicate"
  notes     String?  @db.Text
  createdAt DateTime @default(now())

  @@index([jobId])
}

// ─────────────────────────────────────────────
// Users & CV Management (Section 7)
// ─────────────────────────────────────────────

model User {
  id           String        @id @default(uuid())
  email        String?       @unique
  phone        String?
  passwordHash String?
  language     String        @default("en")           // "en" | "am" | "om"
  regions      String[]                               // preferred regions
  sectors      String[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  cvProfiles   CvProfile[]
  applications ApplicationRecord[]
  savedJobs    SavedJob[]
  savedSearches SavedSearch[]
  notifications NotificationHistory[]
  consentLogs   ConsentLog[]
  aiUsage       AiUsageLog[]
}

model CvProfile {
  id              String   @id @default(uuid())
  userId          String
  title           String                             // e.g. "Software Engineer CV"
  fullName        String?
  email           String?
  phone           String?
  location        String?
  summary         String?  @db.Text
  rawText         String?  @db.Text                  // extracted text
  originalFileUrl String?                            // preserved original PDF/DOCX (Section 7)
  originalFileName String?
  isDefault       Boolean  @default(false)
  userVerified    Boolean  @default(false)           // user has reviewed/corrected
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  education    CvEducation[]
  experience   CvExperience[]
  skills       CvSkill[]
  applications ApplicationRecord[]
  matches      JobMatchCache[]

  @@index([userId])
}

model CvEducation {
  id          String   @id @default(uuid())
  cvId        String
  institution String
  degree      String
  field       String?
  level       EducationLevel @default(NOT_SPECIFIED)
  cgpa        Decimal? @db.Decimal(3,2)              // CGPA where provided
  startYear   Int?
  endYear     Int?

  cv CvProfile @relation(fields: [cvId], references: [id], onDelete: Cascade)

  @@index([cvId])
}

model CvExperience {
  id          String   @id @default(uuid())
  cvId        String
  employer    String
  title       String
  location    String?
  startDate   DateTime?
  endDate     DateTime?
  isCurrent   Boolean  @default(false)
  isInternship Boolean @default(false)
  description String?  @db.Text

  cv CvProfile @relation(fields: [cvId], references: [id], onDelete: Cascade)

  @@index([cvId])
}

model CvSkill {
  id        String @id @default(uuid())
  cvId      String
  name      String
  category  String?                                  // "hard" | "soft" | "language" | "tool"
  level     String?                                  // "beginner" | "intermediate" | "advanced"

  cv CvProfile @relation(fields: [cvId], references: [id], onDelete: Cascade)

  @@index([cvId])
}

// ─────────────────────────────────────────────
// Matching Cache (Section 7)
// ─────────────────────────────────────────────

model JobMatchCache {
  id                String   @id @default(uuid())
  cvId              String
  jobId             String
  contentHash       String                           // hash(cv.rawText + job.description)
  score             Decimal  @db.Decimal(5,2)        // 0.00 - 100.00
  educationScore    Decimal  @db.Decimal(5,2)
  skillsScore       Decimal  @db.Decimal(5,2)
  experienceScore   Decimal  @db.Decimal(5,2)
  strongMatches     Json                             // string[]
  missingRequirements Json                           // string[]
  partialRequirements Json                           // string[]
  unknownRequirements Json                           // string[]
  disqualifiers     Json                             // string[]
  aiExplanation     String?  @db.Text
  providerUsed      String?                          // "groq" | "nvidia" | "mistral" | "none"
  calculatedAt      DateTime @default(now())

  cv  CvProfile @relation(fields: [cvId], references: [id], onDelete: Cascade)
  job Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@unique([cvId, jobId])
  @@index([jobId])
  @@index([contentHash])
}

// ─────────────────────────────────────────────
// Application Tracking (Section 11)
// ─────────────────────────────────────────────

enum ApplicationStatus {
  INTERESTED
  SAVED
  PREPARING
  APPLIED
  ASSESSMENT
  INTERVIEW
  OFFER
  REJECTED
  WITHDRAWN
  EXPIRED
}

model ApplicationRecord {
  id              String            @id @default(uuid())
  userId          String
  jobId           String?
  cvId            String?
  employer        String
  jobTitle        String
  status          ApplicationStatus @default(INTERESTED)
  appliedAt       DateTime?
  cvVersion       String?                            // snapshot of CV title/id used
  coverLetter     String?           @db.Text
  followUpDate    DateTime?
  interviewDate   DateTime?
  notes           String?           @db.Text
  history         Json?                              // {status, timestamp, note}[]
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  user User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  job  Job?       @relation(fields: [jobId], references: [id], onDelete: SetNull)
  cv   CvProfile? @relation(fields: [cvId], references: [id], onDelete: SetNull)

  @@index([userId, status])
  @@index([followUpDate])
  @@index([interviewDate])
}

model SavedJob {
  id        String   @id @default(uuid())
  userId    String
  jobId     String
  notes     String?  @db.Text
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  job  Job  @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@unique([userId, jobId])
  @@index([userId])
}

model SavedSearch {
  id        String   @id @default(uuid())
  userId    String
  name      String
  filters   Json                                     // {query, regions[], sectors[], education[], employmentType[], salaryMin}
  notify    Boolean  @default(true)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// ─────────────────────────────────────────────
// Notifications (Section 15)
// ─────────────────────────────────────────────

enum NotificationType {
  NEW_MATCHING_JOB
  SAVED_SEARCH_ALERT
  APPLICATION_DEADLINE
  INTERVIEW_REMINDER
  FOLLOW_UP_REMINDER
  SYNC_ERROR
}

model NotificationHistory {
  id        String           @id @default(uuid())
  userId    String
  type      NotificationType
  title     String
  body      String           @db.Text
  data      Json?
  sentAt    DateTime         @default(now())
  readAt    DateTime?
  dedupeKey String                                   // hash(userId+type+entityId+dateBucket)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([dedupeKey])
  @@index([userId, sentAt])
}

// ─────────────────────────────────────────────
// AI Usage & Consent (Section 6.B, 6.E, 16)
// ─────────────────────────────────────────────

model AiUsageLog {
  id          String   @id @default(uuid())
  userId      String?
  provider    String                                 // "groq" | "nvidia" | "mistral"
  model       String
  task        String                                 // "cv_extraction" | "matching" | "cover_letter" | "chat" ...
  tokensIn    Int      @default(0)
  tokensOut   Int      @default(0)
  costUsd     Decimal? @db.Decimal(8,4)
  latencyMs   Int      @default(0)
  success     Boolean  @default(true)
  error       String?
  createdAt   DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([provider, createdAt])
  @@index([task])
}

model ConsentLog {
  id        String   @id @default(uuid())
  userId    String
  scope     String                                   // e.g. "ai_cv_processing"
  provider  String                                   // provider consented to
  granted   Boolean
  grantedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, scope])
}
```

---

## 3. Room Database Schema (Android Client)

The Android client keeps a **mirror cache** of the most-used entities for offline operation:

| Room Entity | Corresponds To | Offline Behavior |
|---|---|---|
| `CachedJobEntity` | `Job` + attribution fields | Cached jobs browsable/searchable offline; `lastVerifiedAt` shown; "Cached" vs. "Verified" badge |
| `CachedSourceEntity` | `Source` | Source management list offline |
| `CachedApplicationEntity` | `ApplicationRecord` | Full offline CRUD; synced to backend on reconnect |
| `CachedSavedJobEntity` | `SavedJob` | Bookmarks offline; synced on reconnect |
| `CachedCvEntity` | `CvProfile` | Offline CV profile review |
| `CachedNotificationEntity` | `NotificationHistory` | Notification inbox offline |
| `PendingSyncAction` | — | Queue of offline writes (saves, status changes, new applications) replayed on reconnect |

---

## 4. Key Design Properties

1. **Information honesty (Section 9):** fields are nullable so that missing salaries, deadlines, and employers are stored as *unknown*, never invented. Quality detectors set flags rather than inferring values.
2. **Provenance (Section 9):** every job records `sourceAttribution`, `originalUrl`, `firstDiscoveredAt`, `lastVerifiedAt`, and one or more `JobSourceReference` rows when a vacancy appears on multiple sites.
3. **Deduplication safety (Section 9):** `JobDuplicateCluster` links duplicates without destroying distinct openings, and retains a confidence score.
4. **Transparency (Sections 7, 12):** match scores decompose into dimension sub-scores with explicit missing/partial requirement arrays; risk flags always include a human-readable `reason` and evidence.
5. **Privacy and consent (Sections 6.B, 16):** `ConsentLog` records every AI-processing consent per provider; AI usage logs are anonymizable; CV files are access-controlled and original files are preserved.
6. **Total-outage guarantee (Section 6.E):** matching can be computed entirely client-side or rule-based server-side when `AiUsageLog` is zero — no AI provider is required for the database to function.
