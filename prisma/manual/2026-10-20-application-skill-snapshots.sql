-- Application skill snapshots (2026-10-20): what each job a member applied to asked for, and how
-- the member's skills lined up, frozen at application time (src/lib/applications/skill-snapshot.ts).
--
-- One row per applied application (JobPosting). basis = 'posting' when the application is linked to a
-- board posting (boardJobId: the posting's skills, AI skills and AI tools), 'inferred' when it is not
-- but its title maps to an O*NET occupation (that occupation's in-demand tools; weaker, labelled so).
-- skills / tools / aiSkills, the job's industry, function, sub-function, level and state are copied at
-- snapshot time so later edits or closures of the posting don't change history. matched / missing /
-- matchPct are against the member's skills at that moment and are never rewritten; the current* columns
-- are recomputed when the member's skills change (skillsHash differs).
--
-- Additive only: a new table. Apply with a short lock_timeout before deploying the code; never
-- `prisma db push`.

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "ApplicationSkillSnapshot" (
  "id"               TEXT NOT NULL,
  "jobPostingId"     TEXT NOT NULL,
  "candidateId"      TEXT NOT NULL,
  "appliedAt"        TIMESTAMP(3) NOT NULL,
  "basis"            TEXT NOT NULL,
  "boardJobId"       TEXT,
  "socCode"          TEXT,
  "socTitle"         TEXT,
  "title"            TEXT,
  "companyName"      TEXT,
  "skills"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tools"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "aiSkills"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "industry"         TEXT,
  "jobFunction"      TEXT,
  "subFunction"      TEXT,
  "level"            TEXT,
  "locationState"    TEXT,
  "region"           TEXT,
  "employerSector"   TEXT,
  "matched"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "missing"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "matchPct"         INTEGER,
  "skillsHash"       TEXT NOT NULL,
  "currentMatched"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "currentMissing"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "currentMatchPct"  INTEGER,
  "currentSkillsHash" TEXT NOT NULL,
  "currentAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationSkillSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationSkillSnapshot_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ApplicationSkillSnapshot_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationSkillSnapshot_jobPostingId_key" ON "ApplicationSkillSnapshot"("jobPostingId");
CREATE INDEX IF NOT EXISTS "ApplicationSkillSnapshot_candidateId_appliedAt_idx" ON "ApplicationSkillSnapshot"("candidateId", "appliedAt");
CREATE INDEX IF NOT EXISTS "ApplicationSkillSnapshot_appliedAt_idx" ON "ApplicationSkillSnapshot"("appliedAt");
ALTER TABLE "ApplicationSkillSnapshot" ENABLE ROW LEVEL SECURITY;
