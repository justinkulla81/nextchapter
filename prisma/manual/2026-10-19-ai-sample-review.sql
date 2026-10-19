-- AI work-sample reviews (2026-10-19): a model's written review of one AI work sample, shown only to
-- the member who wrote it. Counted per sample per week and per month for the spending cap.
--
-- Additive only: one new table, nothing existing is touched. Apply with a short lock_timeout.

SET lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS "AiSampleReview" (
  "id"           TEXT PRIMARY KEY,
  "candidateId"  TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "sampleId"     TEXT NOT NULL REFERENCES "WorkSample"("id") ON DELETE CASCADE,
  "model"        TEXT NOT NULL,
  "verdict"      TEXT NOT NULL,
  "checks"       JSONB NOT NULL,
  "summary"      TEXT NOT NULL,
  "suggestions"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "inputTokens"  INTEGER NOT NULL,
  "outputTokens" INTEGER NOT NULL,
  "costMicros"   INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AiSampleReview_candidateId_createdAt_idx" ON "AiSampleReview"("candidateId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiSampleReview_sampleId_createdAt_idx" ON "AiSampleReview"("sampleId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiSampleReview_createdAt_idx" ON "AiSampleReview"("createdAt");
ALTER TABLE "AiSampleReview" ENABLE ROW LEVEL SECURITY;
