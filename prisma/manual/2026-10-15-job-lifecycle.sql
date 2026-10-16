-- Current vs past jobs (src/lib/jobs/job-status.ts). Additive only; applied 2026-10-15.
-- closeReason: why a listing left the board — 'removed' (the employer stopped
-- listing it), 'aged_out' (past our freshness window: director+ 60 days, others
-- 30), 'expired' (not reconfirmed before expiresAt), 'filtered', 'manual'.
-- Null on a live row, and on rows archived before this column existed (the
-- reason is then inferred on read — inferCloseReason).
-- reopenCount: how many times the crawler saw this listing close and come back.
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "closeReason" text, ADD COLUMN IF NOT EXISTS "reopenCount" integer;
ALTER TABLE "CompanyJobOpening" ADD COLUMN IF NOT EXISTS "closeReason" text;
-- Reposts and duplicates (crawler repost_groups.py): times the role came back, the
-- role's original first-seen date, and on the copy shown, how many other copies of it
-- were collapsed (archived with closeReason 'duplicate').
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "repostCount" integer, ADD COLUMN IF NOT EXISTS "repostFirstSeenAt" timestamp(3), ADD COLUMN IF NOT EXISTS "duplicateCount" integer;
-- Ghost risk subtracts collapsed duplicates from its closed-before counts (ghost-risk-data.ts).
CREATE INDEX IF NOT EXISTS "ExclusiveJobPosting_closeReason_dup_idx" ON "ExclusiveJobPosting" ("companyName") WHERE "closeReason" = 'duplicate';
