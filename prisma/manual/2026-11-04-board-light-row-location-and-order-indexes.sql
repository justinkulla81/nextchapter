-- The /jobs board's location search (`location ILIKE '%city%'`, ~24,000 calls at 2.6 s each) and its newest-first
-- listing (`ORDER BY postedAt DESC NULLS LAST, createdAt DESC` over live approved rows) were full scans of
-- BoardLightRow (~1.17M rows). Measured on production 2026-11-04 (EXPLAIN ANALYZE, "Austin"):
--   location count   849 ms -> 169 ms     first page of results 13.7 ms (index scan, stops after 25 rows)
--   unfiltered first page -> 0.07 ms
-- Additive; drop either index to undo. Applied to production 2026-11-04. Run each statement on its own
-- (CONCURRENTLY cannot run inside a transaction).
create index concurrently if not exists "BoardLightRow_location_trgm_idx" on "BoardLightRow" using gin (location extensions.gin_trgm_ops);
create index concurrently if not exists "BoardLightRow_live_order_idx" on "BoardLightRow" ("postedAt" desc nulls last, "createdAt" desc) where status = 'approved' and "archivedAt" is null and "institutionScopeId" is null and distribution = 'OPEN';
