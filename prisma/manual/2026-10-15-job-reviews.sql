-- Job reviews (how a member got a past job, how the employer was, what they
-- liked/disliked) and parallel paths (what they do alongside the search).
-- Additive only: two new tables, no change to existing ones. Apply by hand;
-- never plain `prisma db push` on prod.

CREATE TABLE IF NOT EXISTS "JobExperienceReview" (
  "id"             TEXT PRIMARY KEY,
  "candidateId"    TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "workHistoryId"  TEXT NOT NULL REFERENCES "WorkHistoryEntry"("id") ON DELETE CASCADE,
  "companyId"      TEXT,
  "hiredVia"       TEXT,
  "workerType"     TEXT,
  "employerRating" SMALLINT,
  "wouldRecommend" TEXT,
  "liked"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "disliked"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobExperienceReview_workHistoryId_key" ON "JobExperienceReview" ("workHistoryId");
CREATE INDEX IF NOT EXISTS "JobExperienceReview_candidateId_idx" ON "JobExperienceReview" ("candidateId");
CREATE INDEX IF NOT EXISTS "JobExperienceReview_companyId_idx" ON "JobExperienceReview" ("companyId");

CREATE TABLE IF NOT EXISTS "ParallelPath" (
  "id"          TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "paths"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ParallelPath_candidateId_key" ON "ParallelPath" ("candidateId");

-- The app is the only client; match the other tables' posture.
ALTER TABLE "JobExperienceReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParallelPath" ENABLE ROW LEVEL SECURITY;
