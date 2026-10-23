-- Recruiter coverage tags on CrmPerson. Additive, safe to re-run.
ALTER TABLE "CrmPerson" ADD COLUMN IF NOT EXISTS "coverageStates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CrmPerson" ADD COLUMN IF NOT EXISTS "coverageIndustries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CrmPerson" ADD COLUMN IF NOT EXISTS "coverageFunctions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CrmPerson" ADD COLUMN IF NOT EXISTS "coverageSource" TEXT;
CREATE INDEX IF NOT EXISTS "CrmPerson_coverageStates_idx" ON "CrmPerson" USING GIN ("coverageStates");
