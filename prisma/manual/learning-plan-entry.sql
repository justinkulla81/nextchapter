-- Talent Hub phase 10: the learning plan (a person's own list of courses; counted anonymously by their groups). Additive only.
CREATE TABLE IF NOT EXISTS "LearningPlanEntry" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "provider" TEXT,
  "url" TEXT NOT NULL,
  "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "slot" TEXT,
  "isSampleData" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LearningPlanEntry_candidateId_title_key" ON "LearningPlanEntry"("candidateId", "title");
CREATE INDEX IF NOT EXISTS "LearningPlanEntry_candidateId_status_idx" ON "LearningPlanEntry"("candidateId", "status");
