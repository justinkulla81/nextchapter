-- CompanyAlias: admin-confirmed abbreviations ("AWS" -> Amazon Web Services) and
-- rejected pairs. Additive only (one table). Apply by hand BEFORE the deploy that
-- reads it; never plain `prisma db push` on prod. Safe to re-run. Until it is
-- applied the app still works: alias lookups fail quietly and read as "no aliases".
CREATE TABLE IF NOT EXISTS "CompanyAlias" (
  "id" TEXT PRIMARY KEY,
  "aliasKey" TEXT NOT NULL,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyAlias_aliasKey_companyId_key" ON "CompanyAlias"("aliasKey", "companyId");
CREATE INDEX IF NOT EXISTS "CompanyAlias_aliasKey_idx" ON "CompanyAlias"("aliasKey");
ALTER TABLE "CompanyAlias" ENABLE ROW LEVEL SECURITY;
