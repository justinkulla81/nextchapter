-- How I perform, saved a round at a time: one draft row per candidate (item id -> score 1-4).
-- Additive, re-runnable. The rounds flow fails soft without it (it falls back to this browser's own copy),
-- but run it BEFORE the deploy so progress is kept across devices.
CREATE TABLE IF NOT EXISTS "PerformanceAssessmentDraft" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "answers" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceAssessmentDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PerformanceAssessmentDraft_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PerformanceAssessmentDraft_candidateId_key" ON "PerformanceAssessmentDraft"("candidateId");
