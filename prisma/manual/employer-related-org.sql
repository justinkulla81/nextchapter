-- Talent Hub phase 13: organizations an employer linked from its hiring portal (Your network). Additive only.
CREATE TABLE IF NOT EXISTS "EmployerRelatedOrg" (
  "id" TEXT PRIMARY KEY,
  "employerProfileId" TEXT NOT NULL REFERENCES "EmployerProfile"("id") ON DELETE CASCADE,
  "crmOrganizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'OTHER',
  "inviteToken" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'INVITED',
  "linkedInstitutionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmployerRelatedOrg_inviteToken_key" ON "EmployerRelatedOrg"("inviteToken");
CREATE UNIQUE INDEX IF NOT EXISTS "EmployerRelatedOrg_employerProfileId_crmOrganizationId_key" ON "EmployerRelatedOrg"("employerProfileId", "crmOrganizationId");
CREATE INDEX IF NOT EXISTS "EmployerRelatedOrg_crmOrganizationId_idx" ON "EmployerRelatedOrg"("crmOrganizationId");
