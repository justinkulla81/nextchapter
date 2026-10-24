-- Capability matrix for the Vision area: what NextChapter can do (ProductCapability) and what each competitor
-- does for each of those (CompetitorCapability). Additive only. Apply before the deploy that reads it;
-- the matrix page shows a message instead of failing while the tables are missing. Never `prisma db push` on prod.

DO $$ BEGIN
  CREATE TYPE "ProductCapabilityStatus" AS ENUM ('BUILT', 'PARTIAL', 'PLANNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CompetitorCapabilityStatus" AS ENUM ('YES', 'PARTIAL', 'NO', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ProductCapability" (
  "id"           text PRIMARY KEY,
  "key"          text NOT NULL,
  "area"         text NOT NULL,
  "name"         text NOT NULL,
  "description"  text NOT NULL,
  "ours"         "ProductCapabilityStatus" NOT NULL,
  "evidencePath" text NOT NULL,
  "sortOrder"    integer NOT NULL DEFAULT 0,
  "updatedAt"    timestamp(3) NOT NULL DEFAULT current_timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductCapability_key_key" ON "ProductCapability"("key");
CREATE INDEX IF NOT EXISTS "ProductCapability_area_sortOrder_idx" ON "ProductCapability"("area", "sortOrder");

CREATE TABLE IF NOT EXISTS "CompetitorCapability" (
  "id"           text PRIMARY KEY,
  "competitorId" text NOT NULL REFERENCES "ProductCompetitor"("id") ON DELETE CASCADE,
  "capabilityId" text NOT NULL REFERENCES "ProductCapability"("id") ON DELETE CASCADE,
  "status"       "CompetitorCapabilityStatus" NOT NULL DEFAULT 'UNKNOWN',
  "note"         text,
  "evidenceUrl"  text,
  "checkedAt"    timestamp(3),
  "checkedBy"    text
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorCapability_competitorId_capabilityId_key" ON "CompetitorCapability"("competitorId", "capabilityId");
CREATE INDEX IF NOT EXISTS "CompetitorCapability_capabilityId_idx" ON "CompetitorCapability"("capabilityId");
CREATE INDEX IF NOT EXISTS "CompetitorCapability_competitorId_checkedAt_idx" ON "CompetitorCapability"("competitorId", "checkedAt");
