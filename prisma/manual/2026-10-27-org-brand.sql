-- Brand colors read from an organization's website, for its public page and launch kit (src/lib/branding). Additive: one new table, no existing table touched.
-- The code is fail-soft: a missing table reads as "no brand", so this can be applied before or after the deploy.
CREATE TABLE IF NOT EXISTS "OrgBrand" (
  "kind"             TEXT NOT NULL,
  "sourceId"         TEXT NOT NULL,
  "siteUrl"          TEXT,
  "primary"          TEXT NOT NULL,
  "secondary"        TEXT NOT NULL,
  "secondaryDerived" BOOLEAN NOT NULL DEFAULT false,
  "candidates"       JSONB,
  -- SCAN | MANUAL
  "source"           TEXT NOT NULL DEFAULT 'SCAN',
  "scannedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrgBrand_pkey" PRIMARY KEY ("kind", "sourceId")
);
