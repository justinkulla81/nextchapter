-- Job liveness (2026-10-17): show live jobs only.
--
-- ExclusiveJobPosting."lastVerifiedAt": when we last confirmed the posting is still up —
-- the crawler saw it in a source re-crawl, its liveness check found it live
-- (ncrawl/liveness.py, pushed through /api/admin/jobs/liveness), or the click-time check
-- did (/dashboard/jobs/open/[id]). NOT the same as lastConfirmedAt, which every daily
-- import stamps for every row it sends. Cards say "Last checked N days ago" past 3 days;
-- the click-time check runs when it is older than 24 hours. Null = never sent.
-- Dead postings are archived with closeReason 'expired_checked' (job-status.ts).
--
-- Additive only: one nullable column (metadata-only, no rewrite). Apply with a short lock_timeout.

SET lock_timeout = '5s';
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMP(3);
