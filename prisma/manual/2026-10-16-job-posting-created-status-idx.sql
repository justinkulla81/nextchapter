-- ExclusiveJobPosting (createdAt, status): lets the admin "new job-board listings in the
-- last 7 days, status <> 'rejected'" count (src/lib/admin/homepage-summary.ts) run as an
-- index-only scan instead of a heap scan of the ~1.1 GB table. Additive, no data change.
-- Apply by hand, OUTSIDE a transaction (CREATE INDEX CONCURRENTLY cannot run in one), e.g.
-- paste this single statement into the Supabase SQL editor. Never plain `prisma db push` on prod.
-- Optional afterwards, to refresh the visibility map so index-only scans skip the heap:
--   VACUUM (ANALYZE) "ExclusiveJobPosting";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_createdAt_status_idx"
  ON "ExclusiveJobPosting" ("createdAt", "status");
