-- One-tap logging prompts (2026-10-17): "Did you send it?", "Did you apply?" and the
-- weekly check-in in Job Search Daily. All additive. Run with a short lock_timeout.
SET lock_timeout = '5s';

-- A message the member says they sent, channel not asked.
ALTER TYPE "OutreachChannel" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TABLE "OutreachLog"
  ADD COLUMN IF NOT EXISTS "logSource" TEXT,
  ADD COLUMN IF NOT EXISTS "companyName" TEXT,
  ADD COLUMN IF NOT EXISTS "contactKind" TEXT,
  ADD COLUMN IF NOT EXISTS "jobId" TEXT,
  ADD COLUMN IF NOT EXISTS "noteKey" TEXT,
  ADD COLUMN IF NOT EXISTS "selfReportKey" TEXT;
-- NULLs are distinct, so only check-in rows (which set the key) are constrained.
CREATE UNIQUE INDEX IF NOT EXISTS "OutreachLog_candidateId_selfReportKey_key" ON "OutreachLog" ("candidateId", "selfReportKey");

ALTER TABLE "JobPosting" ADD COLUMN IF NOT EXISTS "selfReportKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "JobPosting_candidateId_selfReportKey_key" ON "JobPosting" ("candidateId", "selfReportKey");
