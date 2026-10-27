-- CEO speaking/panel/application opportunities, and a function area on CRM to-dos. Additive; safe to re-run.
ALTER TABLE "CrmTask" ADD COLUMN IF NOT EXISTS "area" TEXT;

CREATE TABLE IF NOT EXISTS "CeoSpeakingOpportunity" (
  "id"        TEXT PRIMARY KEY,
  "kind"      TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "hostName"  TEXT,
  "url"       TEXT,
  "eventDate" TIMESTAMP(3),
  "deadline"  TIMESTAMP(3),
  "location"  TEXT,
  "audience"  TEXT,
  "why"       TEXT,
  "fit"       INTEGER NOT NULL DEFAULT 2,
  "status"    TEXT NOT NULL DEFAULT 'NEW',
  "notes"     TEXT,
  "source"    TEXT NOT NULL DEFAULT 'ADMIN',
  "sourceRef" TEXT,
  "taskId"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CeoSpeakingOpportunity_sourceRef_key" ON "CeoSpeakingOpportunity"("sourceRef");
CREATE INDEX IF NOT EXISTS "CeoSpeakingOpportunity_status_deadline_idx" ON "CeoSpeakingOpportunity"("status","deadline");
CREATE INDEX IF NOT EXISTS "CeoSpeakingOpportunity_kind_idx" ON "CeoSpeakingOpportunity"("kind");
