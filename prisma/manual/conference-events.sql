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
