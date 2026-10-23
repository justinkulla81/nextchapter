-- Ties each BenefitProgram to a geography (county GeoArea) and to an employer.
-- Additive only. geoAreaId is filled by linkBenefitGeo() from locality/city; employerKey is
-- normalizeOrgName(employer), the same key CrmOrganization.canonicalNameNormalized uses.
ALTER TABLE "BenefitProgram" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "BenefitProgram" ADD COLUMN IF NOT EXISTS "employer" TEXT;
ALTER TABLE "BenefitProgram" ADD COLUMN IF NOT EXISTS "employerKey" TEXT;
ALTER TABLE "BenefitProgram" ADD COLUMN IF NOT EXISTS "geoAreaId" TEXT;
CREATE INDEX IF NOT EXISTS "BenefitProgram_geoAreaId_idx" ON "BenefitProgram"("geoAreaId");
CREATE INDEX IF NOT EXISTS "BenefitProgram_employerKey_idx" ON "BenefitProgram"("employerKey");
