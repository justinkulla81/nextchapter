-- How a recruiter works (retained / contingent / candidate representation). Additive, safe to re-run.
ALTER TABLE "CrmPerson" ADD COLUMN IF NOT EXISTS "recruiterModels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CrmPerson" ADD COLUMN IF NOT EXISTS "modelEvidence" TEXT;
CREATE INDEX IF NOT EXISTS "CrmPerson_recruiterModels_idx" ON "CrmPerson" USING GIN ("recruiterModels");
