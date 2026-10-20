-- Posting signals (2026-10-20): who a posting says it welcomes, read by the crawler from the
-- FULL posting text (ncrawl/posting_signals.py) and sent by import-jobs.py as postingSignals:
--   career_changer_welcome  career changers / non-traditional paths / transferable skills /
--                           returners / no degree / bootcamps welcome
--   ai_upskilled_welcome    self-taught AI, AI courses or certificates count, learning AI welcome
--   high_eq                 emotional intelligence asked for as a trait of the hire
-- Board tag ("Open to career changers", "Values EQ"), the "Open to career changers / AI-upskilled"
-- filter and a small ranking lift for pivoting / early-career members read it
-- (src/lib/jobs/posting-signals*.ts).
--
-- Additive only: a column with a constant default (metadata-only, no rewrite) and a partial index
-- holding only the rows that carry a signal (~1-2% of the board), so the board's id -> signals read
-- is an index-only scan. Applied 2026-10-20 through the Supabase MCP with a 5 s lock_timeout.
-- Backfilled with batched UPDATEs from stored descriptions + the crawler's Workday cache.

SET lock_timeout = '5s';
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "postingSignals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX IF NOT EXISTS "ExclusiveJobPosting_posting_signals_idx"
  ON "ExclusiveJobPosting" (id) INCLUDE ("postingSignals") WHERE cardinality("postingSignals") > 0;

-- Check: EXPLAIN SELECT id, "postingSignals" FROM "ExclusiveJobPosting" WHERE cardinality("postingSignals") > 0;
-- should be an Index Only Scan using ExclusiveJobPosting_posting_signals_idx.
