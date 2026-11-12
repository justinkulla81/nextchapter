-- Dropped from production on 2026-11-12 (idx_scan = 0, 9-11 MB each, ~31 MB in all). The two filter indexes
-- (above_market_live, strong_benefits_live) were rebuilt the same day because the Great pay / Great benefits
-- filters need them; only ai_exposed_ids_idx stays dropped. The notes below describe the state while they were gone.
--   DROP INDEX CONCURRENTLY IF EXISTS "ExclusiveJobPosting_ai_exposed_ids_idx";
--   DROP INDEX CONCURRENTLY IF EXISTS "ExclusiveJobPosting_above_market_live_idx";
--   DROP INDEX CONCURRENTLY IF EXISTS "ExclusiveJobPosting_strong_benefits_live_idx";
--
-- Effect: src/lib/jobs/great-employers-data.ts only loads the "Great pay" / "Great benefits" job-id sets when these two
-- indexes exist (a missing index means an empty set, not a slow board), so those two filters on /dashboard/find-my-job
-- return no jobs until the indexes are recreated below. 2026-10-20-ai-exposure.sql created ai_exposed_ids_idx; nothing
-- else reads it.
--
-- To undo (run each statement on its own; CONCURRENTLY cannot run inside a transaction):
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_ai_exposed_ids_idx"
  ON "ExclusiveJobPosting" (id) WHERE "aiExposed";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_above_market_live_idx"
  ON "ExclusiveJobPosting" (id) WHERE "payVsMarket" = 'above' AND "archivedAt" IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_strong_benefits_live_idx"
  ON "ExclusiveJobPosting" (id) WHERE "benefitsStrong" = true AND "archivedAt" IS NULL;
