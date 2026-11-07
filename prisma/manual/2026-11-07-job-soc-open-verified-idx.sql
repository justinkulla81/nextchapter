-- "Jobs like this" block on a public job page (similarJobsLike, src/lib/jobs/public-job-page-server.ts): the newest 200 open rows of one
-- occupation (socCode) by lastVerifiedAt. Without this index the planner bitmap-scanned every open row of the occupation (up to ~26,000)
-- and sorted them, which never fit the 3 s statement limit: from 2026-11-07 10:05 ET it was cancelled ~2,900 times an hour, and the
-- reads it burned slowed every other page on the shared database (the "Pages are slow for members" emails).
-- Additive; CONCURRENTLY so writes to the table are not blocked. Run outside a transaction. Applied to production 2026-11-07.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_soc_open_verified_idx"
  ON "ExclusiveJobPosting" ("socCode", "lastVerifiedAt" DESC NULLS LAST)
  WHERE status = 'approved' AND "archivedAt" IS NULL AND "closeReason" IS NULL;
