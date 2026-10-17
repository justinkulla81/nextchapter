-- CrmMandate: a recruiter's mandate at a company. Additive only (one enum, one
-- table). Apply by hand BEFORE the deploy that reads it; never plain
-- `prisma db push` on prod. Safe to re-run.
DO $$ BEGIN
  CREATE TYPE "CrmMandateStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CrmMandate" (
  "id" TEXT PRIMARY KEY,
  "recruiterId" TEXT NOT NULL REFERENCES "CrmPerson"("id") ON DELETE CASCADE,
  "orgId" TEXT NOT NULL REFERENCES "CrmOrganization"("id") ON DELETE CASCADE,
  "scope" TEXT,
  "status" "CrmMandateStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "CrmMandate_recruiterId_idx" ON "CrmMandate"("recruiterId");
CREATE INDEX IF NOT EXISTS "CrmMandate_orgId_idx" ON "CrmMandate"("orgId");
CREATE INDEX IF NOT EXISTS "CrmMandate_status_idx" ON "CrmMandate"("status");
ALTER TABLE "CrmMandate" ENABLE ROW LEVEL SECURITY;
