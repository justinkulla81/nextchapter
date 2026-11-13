-- BoardLightRow: newest live rows for one function and level (similar jobs for a posting with no occupation code,
-- loadLikeRoles in src/lib/jobs/public-job-page-server.ts). Without it the query is a parallel sequential scan of the whole
-- table (~1.4M rows, ~51k pages): 2,583 calls averaged 448 ms and read 34M blocks (pg_stat_statements, 2026-11-13).
-- Additive and idempotent. CONCURRENTLY, so it cannot run inside a transaction: run it as its own statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BoardLightRow_function_level_posted_idx"
  ON "BoardLightRow" ("targetFunction", "level", "postedAt" DESC NULLS LAST)
  WHERE status = 'approved' AND "archivedAt" IS NULL;
