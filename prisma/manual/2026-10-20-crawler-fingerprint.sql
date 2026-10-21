-- Crawler fingerprint (2026-10-20): the crawler's own row id (ncrawl jobs.fingerprint, 24 hex
-- chars), sent by import-jobs.py as crawlerFingerprint and stored on every imported board row.
--
-- Why: every crawler backfill (AI tags, posting signals, function retags) matched board rows by
-- url, falling back to a unique externalJobId. A listing's url can change after import (Careerjet's
-- jobviewtrack.com tracking urls and Jooble /jdp/ ids are re-issued on every crawl), so ~80k live
-- rows had no crawler match. Backfills now join on crawlerFingerprint first, url as the fallback.
--
-- Additive only: a nullable column (metadata-only, no rewrite) and a plain btree index. Applied
-- 2026-10-20 through the Supabase MCP with a 5 s lock_timeout. Existing rows were backfilled in
-- batches of 5,000 from a local match against the crawler (url, normalized url, source id /
-- requisition id + employer, repost key + employer; never when a row had two candidates).

SET lock_timeout = '5s';
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "crawlerFingerprint" TEXT;
CREATE INDEX IF NOT EXISTS "ExclusiveJobPosting_crawlerFingerprint_idx"
  ON "ExclusiveJobPosting" ("crawlerFingerprint");
