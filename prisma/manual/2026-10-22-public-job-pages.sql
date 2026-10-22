-- Public job pages + Google for Jobs (2026-10-22).
--
-- /jobs/[id] is a public, indexable page for a job that passes the allowlist in
-- src/lib/jobs/public-job-page.ts. The job sitemaps (src/app/jobs/sitemap.ts) list
-- exactly those jobs, split into 16 files by (hashtext(id) & 15) so a job always
-- sits in the same file and every file stays far under Google's 50k-URL limit.
--
-- This partial index holds only the rows that pass the allowlist's fixed
-- (time-independent) rules, keyed by sitemap shard, so one sitemap file is a range
-- scan of ~1/16 of the eligible rows. The time-dependent rules (verified within 7
-- days, not past expiresAt, the 90-day ghost-age rule) are applied in the query.
--
-- KEEP THE WHERE CLAUSE IDENTICAL to PUBLIC_JOB_STATIC_SQL in
-- src/lib/jobs/public-job-page.ts — the planner only uses a partial index when the
-- query's predicate implies it.
--
-- Additive only. CONCURRENTLY: no write lock on the table while it builds. Run the
-- CREATE on its own (not inside a transaction).

SET lock_timeout = '5s';
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_public_page_shard_idx"
  ON "ExclusiveJobPosting" ((hashtext(id) & 15), "lastVerifiedAt")
  INCLUDE (id, "createdAt", "expiresAt", "directListing")
  WHERE status = 'approved'
    AND "archivedAt" IS NULL
    AND "closeReason" IS NULL
    AND disclosure = 'OPEN'
    AND distribution = 'OPEN'
    AND "institutionScopeId" IS NULL
    AND "orgScopeId" IS NULL
    AND source IN ('ats_feed', 'admin', 'employer', 'recruiter')
    AND length(description) >= 200
    AND ("employmentType" IS NULL OR "employmentType" NOT IN ('internship', 'co_op', 'coop'))
    AND title !~* '\m(intern|interns|internships?|student trainee)\M'
    AND ("locationCountry" = 'US' OR ("locationCountry" IS NULL AND "locationState" IS NOT NULL))
    AND COALESCE("reopenCount", 0) < 2
    AND COALESCE("repostCount", 0) < 2;
