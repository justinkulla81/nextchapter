-- AI exposure from the Anthropic Economic Index (AEI), 2026-10-22.
--
-- Source: the AEI release of 2026-06-26 (Claude.ai + 1P API usage, April and May 2026),
-- https://huggingface.co/datasets/Anthropic/EconomicIndex, https://www.anthropic.com/economic-index.
-- Raw files: ~/nextchapter-jobs/data/aei/; built by scripts/careers/aei/build-aei-occupations.py and
-- loaded by scripts/careers/aei/load-aei.ts. Read by src/lib/aei/.
--
-- AEI measures how much people use Claude for an occupation's tasks. It is not a forecast of job
-- loss. The level (src/lib/aei/job-exposure.ts) comes from task coverage: the share of the occupation's
-- O*NET tasks that show up with meaningful use (>= 0.01% of conversations) — High >= 50%,
-- Medium 25-50%, Low < 25%.
--
-- 1. AeiOccupation: one row per O*NET-SOC occupation (O*NET 31.0).
-- 2. AeiTask / AeiTaskSkill / AeiSkill: the AEI tasks, their links to our O*NET skills and tools
--    (Skill ids, via SkillAlias text matching plus fixed task-verb rules), and each skill's
--    usage-weighted automation vs augmentation split.
-- 3. ExclusiveJobPosting: the occupation each job is read as for AEI (the crawler's title match
--    when it has one, else a fixed function x level proxy) and the job's level.
--
-- Additive only: new tables, nullable columns (metadata-only, no rewrite).

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "AeiOccupation" (
  "socCode"          TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "release"          TEXT NOT NULL,
  -- tasks = from this occupation's own O*NET tasks; related = no O*NET tasks ("All Other" codes):
  -- the mean of its closest siblings.
  "basis"            TEXT NOT NULL,
  "taskCount"        INTEGER NOT NULL DEFAULT 0,
  "tasksUsed"        INTEGER NOT NULL DEFAULT 0,
  "taskCoveragePct"  DOUBLE PRECISION,
  "convSharePct"     DOUBLE PRECISION,
  "apiSharePct"      DOUBLE PRECISION,
  "automationPct"    DOUBLE PRECISION,
  "augmentationPct"  DOUBLE PRECISION,
  -- Anthropic's own occupation-level "observed exposure" (Labor market impacts, March 2026), for reference.
  "observedExposure" DOUBLE PRECISION,
  "exposureLevel"    TEXT NOT NULL,
  "topTasks"         JSONB NOT NULL DEFAULT '[]'::jsonb,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AeiOccupation_pkey" PRIMARY KEY ("socCode")
);
ALTER TABLE "AeiOccupation" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "AeiTask" (
  "taskId"          INTEGER NOT NULL,
  "socCode"         TEXT NOT NULL,
  "text"            TEXT NOT NULL,
  "usagePct"        DOUBLE PRECISION,
  "apiUsagePct"     DOUBLE PRECISION,
  "automationPct"   DOUBLE PRECISION,
  "augmentationPct" DOUBLE PRECISION,
  "covered"         BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "AeiTask_pkey" PRIMARY KEY ("taskId")
);
CREATE INDEX IF NOT EXISTS "AeiTask_socCode_idx" ON "AeiTask" ("socCode");
ALTER TABLE "AeiTask" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "AeiTaskSkill" (
  "taskId"  INTEGER NOT NULL,
  "skillId" TEXT NOT NULL,
  -- alias (a Skill / SkillAlias name in the task text) | rule (a fixed task-verb rule)
  "via"     TEXT NOT NULL,
  CONSTRAINT "AeiTaskSkill_pkey" PRIMARY KEY ("taskId", "skillId")
);
CREATE INDEX IF NOT EXISTS "AeiTaskSkill_skillId_idx" ON "AeiTaskSkill" ("skillId");
ALTER TABLE "AeiTaskSkill" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "AeiSkill" (
  "skillId"         TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "taskCount"       INTEGER NOT NULL,
  "usagePct"        DOUBLE PRECISION NOT NULL,
  "automationPct"   DOUBLE PRECISION,
  "augmentationPct" DOUBLE PRECISION,
  "topTask"         TEXT,
  CONSTRAINT "AeiSkill_pkey" PRIMARY KEY ("skillId")
);
ALTER TABLE "AeiSkill" ENABLE ROW LEVEL SECURITY;

-- title = the crawler's O*NET title match (= socCode); function = function x level proxy;
-- default = no function either: a generic management / business-operations occupation by level.
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "aeiSocCode" TEXT;
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "aeiSocSource" TEXT;
-- high | medium | low; null = the occupation has no AEI data.
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "aiExposureLevel" TEXT;
