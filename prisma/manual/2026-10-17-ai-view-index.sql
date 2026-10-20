-- The board's AI / Non-AI / All choice (src/lib/jobs/ai-view-server.ts) keeps the set of posting
-- ids whose aiSkillGroups is non-empty (about 28k of 369k live jobs), cached per server instance.
-- Without an index that read filters every approved row (~1.7 s). This partial index holds only
-- the AI rows, so the read is an index-only scan (~80 ms).
--
-- Additive. Applied 2026-10-17 through the Supabase MCP (which runs inside a transaction, so not
-- CONCURRENTLY; the build took about two seconds).
SET lock_timeout = '5s';
CREATE INDEX IF NOT EXISTS "ExclusiveJobPosting_ai_ids_idx"
  ON "ExclusiveJobPosting" (id) WHERE cardinality("aiSkillGroups") > 0;

-- Check: EXPLAIN ANALYZE SELECT id FROM "ExclusiveJobPosting" WHERE cardinality("aiSkillGroups") > 0;
-- should be an Index Only Scan using ExclusiveJobPosting_ai_ids_idx.
