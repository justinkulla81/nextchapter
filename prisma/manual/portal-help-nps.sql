-- Help & feedback for the employer and coach portals, and the NPS prompt.
-- Additive, safe to re-run. Apply before deploying the code that reads it.
DO $$ BEGIN
  CREATE TYPE "PortalAudience" AS ENUM ('CANDIDATE', 'EMPLOYER', 'COACH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "audience" "PortalAudience" NOT NULL DEFAULT 'CANDIDATE';
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "requesterName" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "requesterEmail" TEXT;
CREATE INDEX IF NOT EXISTS "HelpRequest_audience_candidateId_idx" ON "HelpRequest" ("audience", "candidateId");

ALTER TABLE "ProductFeedback" ADD COLUMN IF NOT EXISTS "portalUserId" TEXT;
CREATE INDEX IF NOT EXISTS "ProductFeedback_portalUserId_idx" ON "ProductFeedback" ("portalUserId");

CREATE TABLE IF NOT EXISTS "NpsResponse" (
  "id" TEXT NOT NULL,
  "audience" "PortalAudience" NOT NULL,
  "respondentId" TEXT NOT NULL,
  "respondentLabel" TEXT,
  "score" INTEGER,
  "comment" TEXT,
  "contextPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NpsResponse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NpsResponse_score_range" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 10))
);
CREATE INDEX IF NOT EXISTS "NpsResponse_audience_respondentId_createdAt_idx" ON "NpsResponse" ("audience", "respondentId", "createdAt");
CREATE INDEX IF NOT EXISTS "NpsResponse_createdAt_idx" ON "NpsResponse" ("createdAt");
ALTER TABLE "NpsResponse" ENABLE ROW LEVEL SECURITY;

-- Recruiter portal joins Help & feedback and NPS.
ALTER TYPE "PortalAudience" ADD VALUE IF NOT EXISTS 'RECRUITER';
