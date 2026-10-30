-- Cold render of a lightly visited city page (/places/ma/city/westford) was 1.8 s, nearly all of it one query:
-- loadRecentJobs / loadTopHiringEmployers filter on lower("locationCity"), which the plain "locationCity" index
-- ("ExclusiveJobPosting_seo_place_idx") cannot serve, so Postgres bitmap-scanned the whole state (~34,000 rows).
-- Same partial predicate as PUBLIC_JOB_STATIC_SQL, keyed on lower("locationCity"). EXPLAIN ANALYZE for Westford MA:
-- 1,807 ms before, 17 ms after. Index is 69 MB. Applied to production 2026-10-29 with CONCURRENTLY (no write lock).
-- Additive; to undo: DROP INDEX CONCURRENTLY "ExclusiveJobPosting_seo_place_lower_idx".

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_seo_place_lower_idx"
  ON "ExclusiveJobPosting" ("locationState", (lower("locationCity")), "lastVerifiedAt" DESC NULLS LAST, id)
  INCLUDE ("companyId", "companyName", title)
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
