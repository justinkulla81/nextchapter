-- Search-firm pages (/search-firms/<slug>): firm searches are found by the crawler's source name. Additive and optional
-- (the pages work without it, just slower); run in the Supabase SQL editor. CONCURRENTLY: no table lock.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_search_firm_source_idx"
  ON "ExclusiveJobPosting" ("sourceName")
  WHERE "sourceCategory" = 'search_firm' AND "archivedAt" IS NULL;
