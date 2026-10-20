-- Organization + OrgWorkspace: one customer, one or many partner portals.
-- Additive only (two new tables, one enum, no change to any existing table).
-- Apply by hand; never plain `prisma db push` on prod.
DO $$ BEGIN
  CREATE TYPE "OrgWorkspaceType" AS ENUM ('HIGHER_ED', 'OUTPLACEMENT', 'WORKFORCE', 'COACH', 'HIRING', 'RECRUITER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "domain" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "brandName" TEXT,
  "logoUrl" TEXT,
  "accentColor" TEXT,
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "demoScenario" TEXT,
  "demoExpiresAt" TIMESTAMP(3),
  "isSampleData" BOOLEAN NOT NULL DEFAULT false,
  "features" JSONB NOT NULL DEFAULT '{}',
  "crmOrganizationId" TEXT UNIQUE REFERENCES "CrmOrganization"("id") ON DELETE SET NULL,
  "createdBy" TEXT
);
CREATE INDEX IF NOT EXISTS "Organization_isDemo_demoExpiresAt_idx" ON "Organization"("isDemo", "demoExpiresAt");
CREATE TABLE IF NOT EXISTS "OrgWorkspace" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "type" "OrgWorkspaceType" NOT NULL,
  "refId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "inviteEmail" TEXT,
  "inviteToken" TEXT UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrgWorkspace_orgId_type_key" ON "OrgWorkspace"("orgId", "type");
CREATE INDEX IF NOT EXISTS "OrgWorkspace_type_refId_idx" ON "OrgWorkspace"("type", "refId");
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrgWorkspace" ENABLE ROW LEVEL SECURITY;
