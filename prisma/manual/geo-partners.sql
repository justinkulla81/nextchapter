-- Additive only. Apply by hand (never plain `prisma db push`).
ALTER TABLE "GeoOrgLead"
  ADD COLUMN IF NOT EXISTS "contactName" TEXT,
  ADD COLUMN IF NOT EXISTS "contactTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "contactSource" TEXT,
  ADD COLUMN IF NOT EXISTS "contactConfidence" TEXT,
  ADD COLUMN IF NOT EXISTS "enrichedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AmericanJobCenter" (
  "id" TEXT PRIMARY KEY,
  "centerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "centerType" TEXT,
  "state" TEXT NOT NULL,
  "street" TEXT,
  "city" TEXT,
  "zip" TEXT,
  "countyFips" TEXT,
  "phone" TEXT,
  "hours" TEXT,
  "generalEmail" TEXT,
  "businessEmail" TEXT,
  "veteranEmail" TEXT,
  "youthEmail" TEXT,
  "detailsUrl" TEXT,
  "workforceBoardId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AmericanJobCenter_state_idx" ON "AmericanJobCenter"("state");
CREATE INDEX IF NOT EXISTS "AmericanJobCenter_countyFips_idx" ON "AmericanJobCenter"("countyFips");
CREATE INDEX IF NOT EXISTS "AmericanJobCenter_workforceBoardId_idx" ON "AmericanJobCenter"("workforceBoardId");

CREATE TABLE IF NOT EXISTS "LocalPartnerOrg" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "abbrev" TEXT,
  "state" TEXT NOT NULL,
  "city" TEXT,
  "counties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "countiesText" TEXT,
  "website" TEXT,
  "contactName" TEXT,
  "contactTitle" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "source" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "confidence" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LocalPartnerOrg_kind_state_idx" ON "LocalPartnerOrg"("kind","state");
ALTER TABLE "AmericanJobCenter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LocalPartnerOrg" ENABLE ROW LEVEL SECURITY;
