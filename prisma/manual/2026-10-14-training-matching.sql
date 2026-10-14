-- Course-to-skill tags and state funded-training programs. Additive and re-runnable.
-- Requires 2026-10-14-career-taxonomy.sql (CourseSkill references "Skill").
-- Course and Skill gain relation fields in Prisma only, no new columns, so this can
-- run before or after the deploy.

CREATE TABLE IF NOT EXISTS "CourseSkill" (
    "courseId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    CONSTRAINT "CourseSkill_pkey" PRIMARY KEY ("courseId","skillId"),
    CONSTRAINT "CourseSkill_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CourseSkill_skillId_idx" ON "CourseSkill"("skillId");

CREATE TABLE IF NOT EXISTS "TrainingProgram" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "url" TEXT,
    "socCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "credential" TEXT,
    "deliveryMode" TEXT,
    "costUsd" INTEGER,
    "durationWeeks" INTEGER,
    "fundingSource" TEXT NOT NULL DEFAULT 'WIOA_ETPL',
    "sourceName" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingProgram_state_providerName_programName_key" ON "TrainingProgram"("state","providerName","programName");
CREATE INDEX IF NOT EXISTS "TrainingProgram_state_idx" ON "TrainingProgram"("state");

ALTER TABLE "CourseSkill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingProgram" ENABLE ROW LEVEL SECURITY;
