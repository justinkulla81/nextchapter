-- Canonical institutions, job-to-company links, undated jobs, alumni community types.
--
-- Purely additive and safe to re-run: new nullable columns, indexes, SET NULL foreign
-- keys, two new tables, two enum values. Nothing is dropped, renamed or rewritten.
--
-- RUN THIS BEFORE the deploy that reads these columns (Prisma selects every scalar
-- column, so the new code fails on EducationEntry / WorkHistoryEntry until they exist).

-- Alumni network community types (opt-in only; see src/lib/community/alumni-networks.ts)
ALTER TYPE "CommunityType" ADD VALUE IF NOT EXISTS 'SCHOOL';
ALTER TYPE "CommunityType" ADD VALUE IF NOT EXISTS 'FORMER_EMPLOYER';

-- School
CREATE TABLE IF NOT EXISTS "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "localCollegeId" TEXT,
    "state" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "reviewState" TEXT,
    "mergeSuggestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "School_canonicalKey_key" ON "School"("canonicalKey");
CREATE INDEX IF NOT EXISTS "School_reviewState_idx" ON "School"("reviewState");

-- EducationEntry -> School
ALTER TABLE "EducationEntry" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "EducationEntry" ADD COLUMN IF NOT EXISTS "degreeLevel" TEXT;
CREATE INDEX IF NOT EXISTS "EducationEntry_schoolId_idx" ON "EducationEntry"("schoolId");

-- WorkHistoryEntry -> Company
ALTER TABLE "WorkHistoryEntry" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
CREATE INDEX IF NOT EXISTS "WorkHistoryEntry_companyId_idx" ON "WorkHistoryEntry"("companyId");

-- Jobs on a resume with no start date
CREATE TABLE IF NOT EXISTS "UndatedEmployment" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "resumeId" TEXT,
    "companyName" TEXT NOT NULL,
    "companyNameNormalized" TEXT NOT NULL,
    "companyId" TEXT,
    "roleTitle" TEXT NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UndatedEmployment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UndatedEmployment_candidateId_companyNameNormalized_roleTit_key"
    ON "UndatedEmployment"("candidateId", "companyNameNormalized", "roleTitle");
CREATE INDEX IF NOT EXISTS "UndatedEmployment_companyId_idx" ON "UndatedEmployment"("companyId");
CREATE INDEX IF NOT EXISTS "UndatedEmployment_candidateId_idx" ON "UndatedEmployment"("candidateId");

-- Foreign keys (guarded so a re-run is a no-op)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EducationEntry_schoolId_fkey') THEN
    ALTER TABLE "EducationEntry" ADD CONSTRAINT "EducationEntry_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkHistoryEntry_companyId_fkey') THEN
    ALTER TABLE "WorkHistoryEntry" ADD CONSTRAINT "WorkHistoryEntry_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UndatedEmployment_candidateId_fkey') THEN
    ALTER TABLE "UndatedEmployment" ADD CONSTRAINT "UndatedEmployment_candidateId_fkey"
      FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UndatedEmployment_companyId_fkey') THEN
    ALTER TABLE "UndatedEmployment" ADD CONSTRAINT "UndatedEmployment_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
