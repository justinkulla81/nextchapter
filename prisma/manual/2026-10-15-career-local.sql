-- Career taxonomy part 2: local pay (BLS OEWS by nation, state and metro), O*NET tasks, and
-- skill aliases. Additive and re-runnable. Requires 2026-10-14-career-taxonomy.sql.
-- No existing table is altered. Load data with `npm run careers:import-bls` (see docs/BLS_LOCAL_DATA_SCOPE.md).
CREATE TABLE IF NOT EXISTS "OccupationWage" (
    "soc6" TEXT NOT NULL,
    "areaType" TEXT NOT NULL,
    "areaCode" TEXT NOT NULL,
    "areaName" TEXT NOT NULL,
    "year" INTEGER,
    "employment" INTEGER,
    "wageP10" INTEGER,
    "wageP25" INTEGER,
    "wageMedian" INTEGER,
    "wageP75" INTEGER,
    "wageP90" INTEGER,
    "ceilingHit" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OccupationWage_pkey" PRIMARY KEY ("soc6","areaType","areaCode")
);
CREATE INDEX IF NOT EXISTS "OccupationWage_areaType_areaCode_idx" ON "OccupationWage"("areaType","areaCode");

CREATE TABLE IF NOT EXISTS "OccupationTask" (
    "id" TEXT NOT NULL,
    "socCode" TEXT NOT NULL,
    "taskId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    CONSTRAINT "OccupationTask_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OccupationTask_socCode_fkey" FOREIGN KEY ("socCode") REFERENCES "Occupation"("socCode") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OccupationTask_socCode_taskId_key" ON "OccupationTask"("socCode","taskId");

CREATE TABLE IF NOT EXISTS "SkillAlias" (
    "alias" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    CONSTRAINT "SkillAlias_pkey" PRIMARY KEY ("alias"),
    CONSTRAINT "SkillAlias_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SkillAlias_skillId_idx" ON "SkillAlias"("skillId");

ALTER TABLE "OccupationWage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OccupationTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SkillAlias" ENABLE ROW LEVEL SECURITY;
