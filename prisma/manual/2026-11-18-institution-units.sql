-- Schools and departments of a university with their own account (owner decision 2026-11-18). Additive, safe to re-run.
CREATE TABLE IF NOT EXISTS "InstitutionUnit" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "school" TEXT NOT NULL,
  "department" TEXT,
  "plan" TEXT NOT NULL DEFAULT 'FREE',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionUnit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstitutionUnit_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "InstitutionUnit_institutionId_idx" ON "InstitutionUnit"("institutionId");
ALTER TABLE "InstitutionUnit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstitutionUser" ADD COLUMN IF NOT EXISTS "unitId" TEXT;
DO $$ BEGIN
  ALTER TABLE "InstitutionUser" ADD CONSTRAINT "InstitutionUser_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "InstitutionUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "InstitutionUser_unitId_idx" ON "InstitutionUser"("unitId");
ALTER TABLE "OrgClaim" ADD COLUMN IF NOT EXISTS "unitSchool" TEXT;
ALTER TABLE "OrgClaim" ADD COLUMN IF NOT EXISTS "unitDepartment" TEXT;
