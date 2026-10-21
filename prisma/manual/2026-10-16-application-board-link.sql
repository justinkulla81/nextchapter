-- Application -> board posting link: which ExclusiveJobPosting a member's
-- application (JobPosting) was for, how it was matched and how sure we are
-- (src/lib/jobs/application-posting-match.ts). Additive only: four nullable
-- columns (metadata-only on Postgres) and one index. Safe to re-run.
-- The app reads these only once all four exist, so it is safe before or after
-- the deploy; never plain `prisma db push` on prod.

ALTER TABLE "JobPosting"
  ADD COLUMN IF NOT EXISTS "boardJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "boardMatchMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "boardMatchConfidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "boardMatchedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "JobPosting_boardJobId_idx" ON "JobPosting"("boardJobId");

-- The matcher looks applications' ATS / requisition ids up on the board.
CREATE INDEX IF NOT EXISTS "ExclusiveJobPosting_externalJobId_idx" ON "ExclusiveJobPosting"("externalJobId");
CREATE INDEX IF NOT EXISTS "ExclusiveJobPosting_requisitionId_idx" ON "ExclusiveJobPosting"("requisitionId");
