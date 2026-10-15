-- Higher ed: core recruiters, recruiting dates, and early-career roles per college.
-- Additive and idempotent. Apply once with:
--   npx prisma db execute --file prisma/sql/2026-10-15-core-recruiters.sql --schema prisma/schema.prisma

ALTER TABLE "InstitutionTargetCompany" ADD COLUMN IF NOT EXISTS "coreRecruiter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InstitutionTargetCompany" ADD COLUMN IF NOT EXISTS "recruiterContactName" TEXT;
ALTER TABLE "InstitutionTargetCompany" ADD COLUMN IF NOT EXISTS "recruiterContactEmail" TEXT;

CREATE TABLE IF NOT EXISTS "InstitutionRecruitingDate" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "url" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstitutionRecruitingDate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InstitutionRecruitingDate_institutionId_startsAt_idx" ON "InstitutionRecruitingDate"("institutionId", "startsAt");
CREATE INDEX IF NOT EXISTS "InstitutionRecruitingDate_companyId_idx" ON "InstitutionRecruitingDate"("companyId");

CREATE TABLE IF NOT EXISTS "InstitutionEarlyCareerRole" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "applyUrl" TEXT,
    "deadline" TIMESTAMP(3),
    "classYears" TEXT,
    "note" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstitutionEarlyCareerRole_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InstitutionEarlyCareerRole_institutionId_archivedAt_idx" ON "InstitutionEarlyCareerRole"("institutionId", "archivedAt");
CREATE INDEX IF NOT EXISTS "InstitutionEarlyCareerRole_companyId_idx" ON "InstitutionEarlyCareerRole"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstitutionRecruitingDate_institutionId_fkey') THEN
    ALTER TABLE "InstitutionRecruitingDate" ADD CONSTRAINT "InstitutionRecruitingDate_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstitutionRecruitingDate_companyId_fkey') THEN
    ALTER TABLE "InstitutionRecruitingDate" ADD CONSTRAINT "InstitutionRecruitingDate_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstitutionEarlyCareerRole_institutionId_fkey') THEN
    ALTER TABLE "InstitutionEarlyCareerRole" ADD CONSTRAINT "InstitutionEarlyCareerRole_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstitutionEarlyCareerRole_companyId_fkey') THEN
    ALTER TABLE "InstitutionEarlyCareerRole" ADD CONSTRAINT "InstitutionEarlyCareerRole_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
