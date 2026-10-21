-- Job board breadth (Narrow / Wide) and skills-adjacent matches (2026-10-16).
--
-- CandidateProfile.boardBreadth: the member's saved choice, 'narrow' | 'wide'.
-- Null = not chosen (the board defaults by career stage; emails use Narrow).
--
-- OccupationSimilarity: every O*NET occupation's closest others (score 0-1, related
-- flag, shared skills), filled by scripts/careers/build-occupation-similarity.ts
-- from the O*NET file. Read whole into memory by the board (src/lib/jobs/search-breadth-server.ts).
--
-- Additive only. Apply by hand before deploying the code; never `prisma db push` on prod.

ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "boardBreadth" TEXT;

CREATE TABLE IF NOT EXISTS "OccupationSimilarity" (
  "socCode"        TEXT NOT NULL,
  "similarSocCode" TEXT NOT NULL,
  "score"          DOUBLE PRECISION NOT NULL,
  "related"        BOOLEAN NOT NULL DEFAULT false,
  "sharedSkills"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "title"          TEXT NOT NULL,
  "similarTitle"   TEXT NOT NULL,
  CONSTRAINT "OccupationSimilarity_pkey" PRIMARY KEY ("socCode", "similarSocCode")
);

-- Same posture as the other taxonomy tables: no client access, the app reads it server-side.
ALTER TABLE "OccupationSimilarity" ENABLE ROW LEVEL SECURITY;
