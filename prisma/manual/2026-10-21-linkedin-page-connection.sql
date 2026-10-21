-- LinkedInAdminConnection: the company page posts go out as. Additive only.
ALTER TABLE "LinkedInAdminConnection" ADD COLUMN IF NOT EXISTS "organizationUrn" TEXT;
ALTER TABLE "LinkedInAdminConnection" ADD COLUMN IF NOT EXISTS "organizationName" TEXT;
