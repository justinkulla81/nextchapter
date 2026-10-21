-- Job benefits + the board's "Great pay" / "Great benefits" filters.
-- Additive only: two nullable columns (metadata-only on Postgres, no rewrite)
-- and two small partial indexes. No backfill — the ncrawl import fills
-- benefits as it sends them. Apply by hand, statement by statement (CREATE
-- INDEX CONCURRENTLY can't run in a transaction); never plain `prisma db push`
-- on prod (it would also try to drop these indexes, which the schema can't
-- express).
--
-- BoardLightRow is untouched: its triggers copy named columns, so new columns
-- on ExclusiveJobPosting don't reach it. The board reads these two sets of ids
-- (a few thousand each) through the partial indexes below and intersects them
-- with its in-memory rows (src/lib/jobs/great-employers.ts).

ALTER TABLE "ExclusiveJobPosting"
  ADD COLUMN IF NOT EXISTS "benefits" JSONB,
  ADD COLUMN IF NOT EXISTS "benefitsStrong" BOOLEAN;

-- Live jobs that post pay above the market for the role (payVsMarket, set by
-- the nightly hiring index). Without it the id lookup scans the wide table (~11 s).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_above_market_live_idx"
  ON "ExclusiveJobPosting" ("id") WHERE "payVsMarket" = 'above' AND "archivedAt" IS NULL;

-- Live jobs with strong structured benefits.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_strong_benefits_live_idx"
  ON "ExclusiveJobPosting" ("id") WHERE "benefitsStrong" = true AND "archivedAt" IS NULL;
