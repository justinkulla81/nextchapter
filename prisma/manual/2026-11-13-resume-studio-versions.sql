-- Resume Studio versions and lossless import. Additive and re-runnable.
-- Every new column is nullable or has a default, so this can run before or after the deploy.
ALTER TABLE "ResumeDraft" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "ResumeDraft" ADD COLUMN IF NOT EXISTS "targetLabel" TEXT;
ALTER TABLE "ResumeDraft" ADD COLUMN IF NOT EXISTS "sourceResumeId" TEXT;
ALTER TABLE "ResumeDraft" ADD COLUMN IF NOT EXISTS "parentDraftId" TEXT;
ALTER TABLE "ResumeDraft" ADD COLUMN IF NOT EXISTS "importReport" JSONB;
CREATE INDEX IF NOT EXISTS "ResumeDraft_candidateId_sourceResumeId_idx" ON "ResumeDraft"("candidateId","sourceResumeId");
