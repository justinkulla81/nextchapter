-- Company lookups by spelling variant ("JPMorgan Chase" for "JP Morgan Chase") compare
-- regexp_replace("canonicalNameNormalized", '[^a-z0-9]', '', 'g') to a value. No index covers
-- that expression, so each lookup scanned all of "Company" (about 55,000 rows, ~100 ms). The
-- job import makes this lookup for every job it links to a company: 17,000 calls ≈ 20 minutes
-- of database time, competing with page loads.
--
-- The queries in src/lib/companies/company-lookup.ts and posting-company.ts write the pattern
-- as literals, so an index on this exact expression is used as written. regexp_replace is
-- IMMUTABLE, so it is allowed in an index.
--
-- Apply by hand (this repo applies schema changes from prisma/manual/). CONCURRENTLY avoids
-- blocking the import's writes; it cannot run inside a transaction, so run it on its own.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Company_squashed_name_idx"
  ON "Company" ((regexp_replace("canonicalNameNormalized", '[^a-z0-9]', '', 'g')));

-- Check: the plan for a lookup should now be an Index Scan using Company_squashed_name_idx.
-- EXPLAIN ANALYZE SELECT * FROM "Company"
--   WHERE regexp_replace("canonicalNameNormalized", '[^a-z0-9]', '', 'g') = 'jpmorganchase'
--   ORDER BY "createdAt" ASC LIMIT 1;
