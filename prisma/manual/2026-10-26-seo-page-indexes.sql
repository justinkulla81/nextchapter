-- Cheaper cold renders for the public SEO pages (/functions, /industries, /topics, /conferences, /associations, /places).
-- Their queries scan every open job and filter in memory: ~540,000 rows fetched from the table, ~520,000 thrown away,
-- 18-35 seconds each (EXPLAIN ANALYZE 2026-10-26), five or more per page, which starved the connection pool.
-- These partial indexes hold only public rows and carry the columns the pages group by, so each query becomes an
-- index-only scan. Additive: CONCURRENTLY, no write lock. Run each CREATE on its own (not inside a transaction).

SET lock_timeout = '5s';

-- A. Topic pages (src/lib/seo/topic-data.ts PUBLIC filter): count, newest, and group by function / industry / employer.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_seo_topic_idx"
  ON "ExclusiveJobPosting" ("lastVerifiedAt")
  INCLUDE ("targetFunction", industry, "companyId", "postedAt")
  WHERE status = 'approved'
    AND "archivedAt" IS NULL
    AND "closeReason" IS NULL
    AND disclosure = 'OPEN'
    AND distribution = 'OPEN'
    AND "institutionScopeId" IS NULL
    AND "orgScopeId" IS NULL;

-- B. Place pages (PUBLIC_JOB_STATIC_SQL in src/lib/jobs/public-job-page-server.ts): by state and city.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_seo_place_idx"
  ON "ExclusiveJobPosting" ("locationState", "locationCity", "lastVerifiedAt")
  INCLUDE (id, "createdAt", "expiresAt", "directListing", "companyId", "companyName", title)
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
