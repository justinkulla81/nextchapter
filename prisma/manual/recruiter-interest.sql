-- A member's interest in a search firm, held against the firm's CRM organization until the member chooses to share.
-- Additive only; safe to re-run. Apply before deploying the code that reads it.
ALTER TYPE "IntakeSource" ADD VALUE IF NOT EXISTS 'MEMBER_INTEREST';

DO $$ BEGIN
  CREATE TYPE "RecruiterInterestStatus" AS ENUM ('HELD', 'SHARED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RecruiterInterest" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "crmOrgId" TEXT NOT NULL REFERENCES "CrmOrganization"("id") ON DELETE CASCADE,
  "source" TEXT NOT NULL,
  "status" "RecruiterInterestStatus" NOT NULL DEFAULT 'HELD',
  "sharedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "RecruiterInterest_candidateId_crmOrgId_key" ON "RecruiterInterest"("candidateId", "crmOrgId");
CREATE INDEX IF NOT EXISTS "RecruiterInterest_crmOrgId_status_idx" ON "RecruiterInterest"("crmOrgId", "status");
