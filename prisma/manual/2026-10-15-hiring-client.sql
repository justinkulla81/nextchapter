-- CrmOrganization.hiringClient: a company we hire for / place candidates with.
-- Additive (two nullable/defaulted columns). Apply by hand BEFORE the deploy
-- that reads it; never plain `prisma db push` on prod. Safe to re-run.
ALTER TABLE "CrmOrganization" ADD COLUMN IF NOT EXISTS "hiringClient" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CrmOrganization" ADD COLUMN IF NOT EXISTS "hiringClientAt" TIMESTAMP(3);

-- Backfill: organizations whose company has a real employer account on the platform.
UPDATE "CrmOrganization" o
   SET "hiringClient" = true, "hiringClientAt" = NOW()
 WHERE o."hiringClient" = false
   AND o."companyId" IN (
     SELECT "companyId" FROM "EmployerProfile" WHERE "companyId" IS NOT NULL AND "isSampleData" = false
   );
