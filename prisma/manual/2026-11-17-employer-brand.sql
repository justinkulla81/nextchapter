-- An employer's own look for its portal Home splash: logo, office building picture, product picture, product name,
-- tagline. Owner decision 2026-11-17. Additive and safe to re-run.
CREATE TABLE IF NOT EXISTS "EmployerBrand" (
  "id" TEXT NOT NULL,
  "ownerKey" TEXT NOT NULL,
  "logoUrl" TEXT,
  "officeImageUrl" TEXT,
  "productImageUrl" TEXT,
  "productName" TEXT,
  "tagline" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployerBrand_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmployerBrand_ownerKey_key" ON "EmployerBrand"("ownerKey");
ALTER TABLE "EmployerBrand" ENABLE ROW LEVEL SECURITY;
