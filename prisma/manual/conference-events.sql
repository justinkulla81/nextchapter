-- ConferenceEvent + ConferenceInterest: conferences and trade shows by industry, function and
-- seniority, controlled in the CRM and shown to candidates. Additive only (two new tables).
-- Apply by hand; never plain `prisma db push` on prod.
CREATE TABLE IF NOT EXISTS "ConferenceEvent" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "organizer" TEXT,
  "url" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'CONFERENCE',
  "format" TEXT NOT NULL DEFAULT 'IN_PERSON',
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "datesConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "typicalMonth" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT NOT NULL DEFAULT 'US',
  "industries" TEXT[] NOT NULL DEFAULT '{}',
  "functions" TEXT[] NOT NULL DEFAULT '{}',
  "seniorities" TEXT[] NOT NULL DEFAULT '{}',
  "importance" INTEGER NOT NULL DEFAULT 2,
  "whyAttend" TEXT,
  "access" TEXT NOT NULL DEFAULT 'PAID',
  "costLow" INTEGER,
  "costHigh" INTEGER,
  "costNote" TEXT,
  "speaking" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "speakingUrl" TEXT,
  "speakingDeadline" TIMESTAMP(3),
  "speakingNote" TEXT,
  "cheaperWays" TEXT,
  "applyUrl" TEXT,
  "applyDeadline" TIMESTAMP(3),
  "published" BOOLEAN NOT NULL DEFAULT false,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "checkedAt" TIMESTAMP(3),
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "adminNote" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ConferenceEvent_published_startDate_idx" ON "ConferenceEvent"("published","startDate");
CREATE INDEX IF NOT EXISTS "ConferenceEvent_importance_idx" ON "ConferenceEvent"("importance");

CREATE TABLE IF NOT EXISTS "ConferenceInterest" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "eventId" TEXT NOT NULL REFERENCES "ConferenceEvent"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceInterest_candidateId_eventId_key" ON "ConferenceInterest"("candidateId","eventId");
CREATE INDEX IF NOT EXISTS "ConferenceInterest_eventId_idx" ON "ConferenceInterest"("eventId");
ALTER TABLE "ConferenceEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConferenceInterest" ENABLE ROW LEVEL SECURITY;

-- 2026-10-23: full mapping by segment and specific job (additive).
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "segments" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "roles" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "journeys" TEXT[] NOT NULL DEFAULT '{}';

-- Heads-up emails: one row per (member, event, stage) so a stage is never sent twice. Additive.
CREATE TABLE IF NOT EXISTS "ConferenceNudge" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceNudge_candidateId_eventId_stage_key" ON "ConferenceNudge"("candidateId","eventId","stage");
CREATE INDEX IF NOT EXISTS "ConferenceNudge_candidateId_sentAt_idx" ON "ConferenceNudge"("candidateId","sentAt");
ALTER TABLE "ConferenceNudge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "programFormats" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "linkStatus" TEXT;
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "linkCheckedAt" TIMESTAMP(3);
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "linkFailures" INTEGER NOT NULL DEFAULT 0;

-- Follow-through: how it went, and next year's notice (additive; the nudge table was empty).
ALTER TABLE "ConferenceInterest" ADD COLUMN IF NOT EXISTS "editionEnd" TIMESTAMP(3);
ALTER TABLE "ConferenceInterest" ADD COLUMN IF NOT EXISTS "outcome" TEXT;
ALTER TABLE "ConferenceInterest" ADD COLUMN IF NOT EXISTS "outcomeAt" TIMESTAMP(3);
ALTER TABLE "ConferenceInterest" ADD COLUMN IF NOT EXISTS "attendedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ConferenceInterest" ADD COLUMN IF NOT EXISTS "spokeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ConferenceNudge" ADD COLUMN IF NOT EXISTS "edition" TEXT NOT NULL DEFAULT '';
DROP INDEX IF EXISTS "ConferenceNudge_candidateId_eventId_stage_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceNudge_candidateId_eventId_stage_edition_key" ON "ConferenceNudge"("candidateId","eventId","stage","edition");
