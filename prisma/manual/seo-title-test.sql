-- A/B tests of page-template titles, read nightly from Search Console (src/lib/seo/title-tests.ts). Additive; safe to re-run.
CREATE TABLE IF NOT EXISTS "SeoTitleTest" (
  "key" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'running',
  "winner" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "result" JSONB
);
