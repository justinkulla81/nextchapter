-- Published federal outcomes per school (College Scorecard). Additive, re-runnable.
-- RUN BEFORE the deploy that reads it.
CREATE TABLE IF NOT EXISTS "SchoolFederalOutcome" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "state" TEXT,
    "enrollment" INTEGER,
    "completionRate" DOUBLE PRECISION,
    "retentionRate" DOUBLE PRECISION,
    "medianEarnings6" INTEGER,
    "medianEarnings10" INTEGER,
    "medianDebt" INTEGER,
    "dataSource" TEXT NOT NULL DEFAULT 'College Scorecard',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolFederalOutcome_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolFederalOutcome_schoolId_key" ON "SchoolFederalOutcome"("schoolId");
