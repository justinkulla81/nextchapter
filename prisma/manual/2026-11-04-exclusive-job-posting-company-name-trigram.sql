-- The CRM organization page (src/lib/crm/org-page-data.ts) matches an organization with no Company link to its
-- postings with `"companyName" ILIKE 'Name'` over ExclusiveJobPosting (~1.2M rows, no index on companyName), a
-- full scan. A trigram GIN index lets Postgres answer that ILIKE from an index. Additive; drop the index to undo.
-- Applied to production 2026-11-04. CONCURRENTLY cannot run inside a transaction, so run it on its own.
create extension if not exists pg_trgm with schema extensions;
create index concurrently if not exists "ExclusiveJobPosting_companyName_trgm_idx" on "ExclusiveJobPosting" using gin ("companyName" extensions.gin_trgm_ops);
