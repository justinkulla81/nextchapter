-- Related organizations (owner decision 2026-11-17): a free organization links others that have their own public page; the
-- invite is that page's claim link, and an approved claim connects the two. Additive and safe to re-run.
ALTER TABLE "EcosystemPartner" ADD COLUMN IF NOT EXISTS "crmOrganizationId" TEXT;
ALTER TABLE "EcosystemPartner" ADD COLUMN IF NOT EXISTS "linkedInstitutionId" TEXT;
CREATE INDEX IF NOT EXISTS "EcosystemPartner_crmOrganizationId_idx" ON "EcosystemPartner"("crmOrganizationId");
CREATE INDEX IF NOT EXISTS "EcosystemPartner_linkedInstitutionId_idx" ON "EcosystemPartner"("linkedInstitutionId");
ALTER TABLE "OrgClaim" ADD COLUMN IF NOT EXISTS "referredByPartnerId" TEXT;
