-- Company graph: the directory Company becomes the shared spine of public business
-- facts, with each role's own record pointing at it.
--
-- Purely additive and safe to re-run: new nullable columns, indexes, foreign keys
-- (SET NULL on delete, so nothing here can delete a posting or an employer), and
-- one new table. Nothing is dropped, renamed, or rewritten.
--
-- RUN THIS BEFORE the deploy that reads these columns. Prisma selects every scalar
-- column by default, so the new code fails on Company / ExclusiveJobPosting / etc.
-- until they exist.

-- Company: website + industry-attempt marker
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "websiteSource" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "industryCheckedAt" TIMESTAMP(3);

-- ExclusiveJobPosting -> Company
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
CREATE INDEX IF NOT EXISTS "ExclusiveJobPosting_companyId_idx" ON "ExclusiveJobPosting"("companyId");

-- CrmOrganization: how the Company link was decided
ALTER TABLE "CrmOrganization" ADD COLUMN IF NOT EXISTS "companyLinkState" TEXT;

-- Role records -> Company
ALTER TABLE "EmployerProfile" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
CREATE INDEX IF NOT EXISTS "EmployerProfile_companyId_idx" ON "EmployerProfile"("companyId");

ALTER TABLE "RecruiterFirm" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
CREATE INDEX IF NOT EXISTS "RecruiterFirm_companyId_idx" ON "RecruiterFirm"("companyId");

ALTER TABLE "OutplacementEmployerOrg" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
CREATE INDEX IF NOT EXISTS "OutplacementEmployerOrg_companyId_idx" ON "OutplacementEmployerOrg"("companyId");

-- Institution target companies
CREATE TABLE IF NOT EXISTS "InstitutionTargetCompany" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionTargetCompany_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstitutionTargetCompany_institutionId_companyId_key"
    ON "InstitutionTargetCompany"("institutionId", "companyId");
CREATE INDEX IF NOT EXISTS "InstitutionTargetCompany_companyId_idx" ON "InstitutionTargetCompany"("companyId");

-- Foreign keys (guarded so a re-run is a no-op)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExclusiveJobPosting_companyId_fkey') THEN
    ALTER TABLE "ExclusiveJobPosting" ADD CONSTRAINT "ExclusiveJobPosting_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmployerProfile_companyId_fkey') THEN
    ALTER TABLE "EmployerProfile" ADD CONSTRAINT "EmployerProfile_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecruiterFirm_companyId_fkey') THEN
    ALTER TABLE "RecruiterFirm" ADD CONSTRAINT "RecruiterFirm_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutplacementEmployerOrg_companyId_fkey') THEN
    ALTER TABLE "OutplacementEmployerOrg" ADD CONSTRAINT "OutplacementEmployerOrg_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstitutionTargetCompany_institutionId_fkey') THEN
    ALTER TABLE "InstitutionTargetCompany" ADD CONSTRAINT "InstitutionTargetCompany_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstitutionTargetCompany_companyId_fkey') THEN
    ALTER TABLE "InstitutionTargetCompany" ADD CONSTRAINT "InstitutionTargetCompany_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
