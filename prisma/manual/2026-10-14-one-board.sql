-- One job board: work types, pay basis, My jobs tracking. Additive only (new
-- nullable columns, one new enum value, one new table). No backfill: every new
-- column is nullable or has a constant default, so this is metadata-only on
-- Postgres. Apply by hand; never plain `prisma db push` on prod.

ALTER TABLE "ExclusiveJobPosting"
  ADD COLUMN IF NOT EXISTS "employmentType" TEXT,
  ADD COLUMN IF NOT EXISTS "payPeriod" TEXT,
  ADD COLUMN IF NOT EXISTS "paySource" TEXT,
  ADD COLUMN IF NOT EXISTS "workArrangement" TEXT,
  ADD COLUMN IF NOT EXISTS "compensationType" TEXT;

ALTER TABLE "CandidateProfile"
  ADD COLUMN IF NOT EXISTS "jobBoardWorkTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TYPE "JobPostingSource" ADD VALUE IF NOT EXISTS 'BOARD';

CREATE TABLE IF NOT EXISTS "TrackedJob" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "source" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "companyName" TEXT,
  "url" TEXT,
  "workType" TEXT,
  "savedAt" TIMESTAMP(3),
  "firstClickedAt" TIMESTAMP(3),
  "lastClickedAt" TIMESTAMP(3),
  "jobPostingId" TEXT REFERENCES "JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "appliedVia" TEXT,
  "promptAnswer" TEXT,
  "promptAnsweredAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TrackedJob_candidateId_source_sourceId_key" ON "TrackedJob"("candidateId", "source", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "TrackedJob_jobPostingId_key" ON "TrackedJob"("jobPostingId");
CREATE INDEX IF NOT EXISTS "TrackedJob_candidateId_updatedAt_idx" ON "TrackedJob"("candidateId", "updatedAt");
ALTER TABLE "TrackedJob" ENABLE ROW LEVEL SECURITY;
