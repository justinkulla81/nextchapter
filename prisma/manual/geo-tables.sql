-- GeoArea + GeoOrgLead. Additive only (two new tables). Apply by hand; never
-- plain `prisma db push` on prod.
CREATE TABLE IF NOT EXISTS "GeoArea" (
  "id" TEXT PRIMARY KEY, "level" TEXT NOT NULL, "state" TEXT NOT NULL, "name" TEXT NOT NULL,
  "population" INTEGER, "laborForce" INTEGER,
  "unemploymentRate" DOUBLE PRECISION, "unemploymentRatePrior" DOUBLE PRECISION, "unemploymentAsOf" TEXT,
  "medianHouseholdIncome" INTEGER, "perCapitaIncome" INTEGER, "whiteCollarShare" DOUBLE PRECISION,
  "wcUnemploymentEst" DOUBLE PRECISION, "bcUnemploymentEst" DOUBLE PRECISION,
  "higherEdCount" INTEGER NOT NULL DEFAULT 0, "higherEdEnrollmentEst" INTEGER NOT NULL DEFAULT 0, "higherEd" JSONB,
  "dataCenterCount" INTEGER NOT NULL DEFAULT 0, "dataCenters" JSONB,
  "wioaBoards" JSONB, "layoffs12mo" INTEGER NOT NULL DEFAULT 0, "layoffEvents12mo" INTEGER NOT NULL DEFAULT 0,
  "layoffs90d" INTEGER NOT NULL DEFAULT 0, "majorEmployers" JSONB,
  "initiatives" TEXT, "news" JSONB, "newsUpdatedAt" TIMESTAMP(3), "dataBuiltAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "GeoArea_level_state_idx" ON "GeoArea"("level","state");
CREATE INDEX IF NOT EXISTS "GeoArea_unemploymentRate_idx" ON "GeoArea"("unemploymentRate");
CREATE INDEX IF NOT EXISTS "GeoArea_whiteCollarShare_idx" ON "GeoArea"("whiteCollarShare");
CREATE TABLE IF NOT EXISTS "GeoOrgLead" (
  "id" TEXT PRIMARY KEY, "ein" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "street" TEXT, "city" TEXT, "state" TEXT NOT NULL, "zip" TEXT,
  "geoAreaId" TEXT REFERENCES "GeoArea"("id") ON DELETE SET NULL,
  "revenue" DOUBLE PRECISION, "assets" DOUBLE PRECISION, "ntee" TEXT, "subsection" TEXT, "taxPeriod" TEXT, "website" TEXT,
  "crmOrganizationId" TEXT, "dismissedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GeoOrgLead_kind_state_idx" ON "GeoOrgLead"("kind","state");
CREATE INDEX IF NOT EXISTS "GeoOrgLead_geoAreaId_idx" ON "GeoOrgLead"("geoAreaId");
CREATE INDEX IF NOT EXISTS "GeoOrgLead_revenue_idx" ON "GeoOrgLead"("revenue" DESC);
ALTER TABLE "GeoArea" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeoOrgLead" ENABLE ROW LEVEL SECURITY;

-- Pitch rule overrides (admin tool). Additive.
CREATE TABLE IF NOT EXISTS "PitchRuleSet" (
  "type" TEXT PRIMARY KEY, "rules" JSONB NOT NULL, "updatedBy" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "PitchRuleSet" ENABLE ROW LEVEL SECURITY;
