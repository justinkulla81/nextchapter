-- Employer sections (Hiring, Employees, Outplacement): the data the build plan needs.
-- docs/specs/employer-sections-build-plan.md. Additive only: one enum value, five columns
-- with defaults on OrgWorkspace, two on Organization, one new table. Nothing is dropped,
-- renamed or rewritten, and no current code reads any of it, so this can be applied before
-- or after the deploy. Apply by hand; never plain `prisma db push` on prod.

-- Postgres cannot USE a new enum value in the same transaction that adds it. This file does
-- not use it. If your SQL tool wraps the file in one transaction, run this line first on its own.
ALTER TYPE "OrgWorkspaceType" ADD VALUE IF NOT EXISTS 'EMPLOYEES';

ALTER TABLE "OrgWorkspace" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE "OrgWorkspace" ADD COLUMN IF NOT EXISTS "planSource" TEXT;
ALTER TABLE "OrgWorkspace" ADD COLUMN IF NOT EXISTS "planUpdatedAt" TIMESTAMP(3);
ALTER TABLE "OrgWorkspace" ADD COLUMN IF NOT EXISTS "planNote" TEXT;
ALTER TABLE "OrgWorkspace" ADD COLUMN IF NOT EXISTS "services" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "enterprise" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "enterpriseSince" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "OrgWorkspaceAdmin" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "OrgWorkspace"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'ADMIN',
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "invitedBy" TEXT,
  "source" TEXT NOT NULL DEFAULT 'INVITE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrgWorkspaceAdmin_workspaceId_email_key" ON "OrgWorkspaceAdmin"("workspaceId", "email");
CREATE INDEX IF NOT EXISTS "OrgWorkspaceAdmin_userId_idx" ON "OrgWorkspaceAdmin"("userId");
ALTER TABLE "OrgWorkspaceAdmin" ENABLE ROW LEVEL SECURITY;
