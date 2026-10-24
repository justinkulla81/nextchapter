-- Conferences v2: editions, typed opportunities, member tracking across years, change review, Quick Add bookkeeping.
-- ConferenceEvent stays the series. Additive only; safe to re-run. Apply by hand; never plain `prisma db push` on prod.
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "urlKey" TEXT;
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "recheckedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ConferenceEvent_urlKey_idx" ON "ConferenceEvent"("urlKey");

CREATE TABLE IF NOT EXISTS "ConferenceEdition" (
  "id" TEXT PRIMARY KEY,
  "seriesId" TEXT NOT NULL REFERENCES "ConferenceEvent"("id") ON DELETE CASCADE,
  "year" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3), "endDate" TIMESTAMP(3),
  "format" TEXT, "city" TEXT, "state" TEXT, "country" TEXT, "url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'TBA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceEdition_seriesId_year_key" ON "ConferenceEdition"("seriesId","year");

CREATE TABLE IF NOT EXISTS "ConferenceOpportunity" (
  "id" TEXT PRIMARY KEY,
  "seriesId" TEXT NOT NULL REFERENCES "ConferenceEvent"("id") ON DELETE CASCADE,
  "editionId" TEXT REFERENCES "ConferenceEdition"("id") ON DELETE SET NULL,
  "type" TEXT NOT NULL, "title" TEXT NOT NULL, "url" TEXT,
  "opensAt" TIMESTAMP(3), "deadline" TIMESTAMP(3),
  "eligibility" TEXT, "notes" TEXT,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT NOT NULL DEFAULT 'ADMIN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ConferenceOpportunity_deadline_idx" ON "ConferenceOpportunity"("deadline");
CREATE INDEX IF NOT EXISTS "ConferenceOpportunity_seriesId_type_idx" ON "ConferenceOpportunity"("seriesId","type");

CREATE TABLE IF NOT EXISTS "ConferenceOpportunityTrack" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL REFERENCES "ConferenceOpportunity"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceOpportunityTrack_candidateId_opportunityId_key" ON "ConferenceOpportunityTrack"("candidateId","opportunityId");
CREATE INDEX IF NOT EXISTS "ConferenceOpportunityTrack_candidateId_status_idx" ON "ConferenceOpportunityTrack"("candidateId","status");

CREATE TABLE IF NOT EXISTS "UserConference" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL, "seriesId" TEXT NOT NULL, "editionId" TEXT,
  "status" TEXT NOT NULL, "notes" TEXT, "goals" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserConference_candidateId_seriesId_key" ON "UserConference"("candidateId","seriesId");
CREATE INDEX IF NOT EXISTS "UserConference_candidateId_status_idx" ON "UserConference"("candidateId","status");
CREATE INDEX IF NOT EXISTS "UserConference_seriesId_idx" ON "UserConference"("seriesId");

CREATE TABLE IF NOT EXISTS "ConferenceContactMet" (
  "id" TEXT PRIMARY KEY,
  "userConferenceId" TEXT NOT NULL REFERENCES "UserConference"("id") ON DELETE CASCADE,
  "contactId" TEXT NOT NULL, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceContactMet_userConferenceId_contactId_key" ON "ConferenceContactMet"("userConferenceId","contactId");

CREATE TABLE IF NOT EXISTS "ConferenceTalk" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL, "seriesId" TEXT, "opportunityId" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'TALK',
  "title" TEXT NOT NULL, "eventName" TEXT, "topic" TEXT,
  "deliveredOn" TIMESTAMP(3), "slidesUrl" TEXT, "videoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ConferenceTalk_candidateId_deliveredOn_idx" ON "ConferenceTalk"("candidateId","deliveredOn");

CREATE TABLE IF NOT EXISTS "ConferenceChange" (
  "id" TEXT PRIMARY KEY,
  "seriesId" TEXT NOT NULL REFERENCES "ConferenceEvent"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "resolvedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ConferenceChange_status_createdAt_idx" ON "ConferenceChange"("status","createdAt");
CREATE INDEX IF NOT EXISTS "ConferenceChange_seriesId_status_idx" ON "ConferenceChange"("seriesId","status");

CREATE TABLE IF NOT EXISTS "ConferenceExtraction" (
  "urlKey" TEXT PRIMARY KEY, "result" JSONB NOT NULL, "contentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "ConferenceQuickAddLog" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL, "urlKey" TEXT NOT NULL,
  "usedModel" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ConferenceQuickAddLog_candidateId_createdAt_idx" ON "ConferenceQuickAddLog"("candidateId","createdAt");

-- Backfill 1: urlKey for existing series (same shape as canonicalUrlKey in src/lib/conferences/canonical.ts, minus tracking-param stripping).
UPDATE "ConferenceEvent"
   SET "urlKey" = regexp_replace(regexp_replace(lower(split_part(split_part("url", '#', 1), '?', 1)), '^https?://(www\.)?', ''), '/+$', '')
 WHERE "url" IS NOT NULL AND "urlKey" IS NULL;

-- Backfill 2: one edition per series that has dates (confirmed) or a TBA edition for the next occurrence.
INSERT INTO "ConferenceEdition" ("id","seriesId","year","startDate","endDate","format","city","state","country","url","status")
SELECT 'ed_' || e."id" || '_' || EXTRACT(YEAR FROM e."startDate")::int, e."id", EXTRACT(YEAR FROM e."startDate")::int,
       e."startDate", e."endDate", e."format", e."city", e."state", e."country", e."url",
       CASE WHEN e."datesConfirmed" THEN 'CONFIRMED' ELSE 'TBA' END
  FROM "ConferenceEvent" e WHERE e."startDate" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill 3: member interest becomes series tracking (SAVED->INTERESTED, GOING->ATTENDING, SPEAKING->SPEAKING, FOLLOWING->TRACKING).
INSERT INTO "UserConference" ("id","candidateId","seriesId","status","createdAt")
SELECT 'uc_' || i."id", i."candidateId", i."eventId",
       CASE i."status" WHEN 'SAVED' THEN 'INTERESTED' WHEN 'GOING' THEN 'ATTENDING' WHEN 'SPEAKING' THEN 'SPEAKING' ELSE 'TRACKING' END,
       i."createdAt"
  FROM "ConferenceInterest" i
ON CONFLICT DO NOTHING;

-- Backfill 4: open speaker calls already on the catalog become typed opportunities.
INSERT INTO "ConferenceOpportunity" ("id","seriesId","type","title","url","deadline","notes","published","source")
SELECT 'op_' || e."id", e."id", 'CALL_FOR_SPEAKERS', 'Call for speakers', e."speakingUrl", e."speakingDeadline", e."speakingNote", e."published", 'ADMIN'
  FROM "ConferenceEvent" e WHERE e."speaking" = 'OPEN_CFP'
ON CONFLICT DO NOTHING;
