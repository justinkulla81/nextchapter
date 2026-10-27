-- /jobs keyword searches run `title ILIKE '%word%' OR "companyName" ILIKE '%word%'` over BoardLightRow
-- (~1M rows, primary-key index only), so every search was a full scan taking 10-25 s. A handful at once
-- filled the 15-connection Prisma pool and the whole site (admin pages included) timed out on 2026-10-27.
-- Trigram GIN indexes let Postgres answer those ILIKEs from an index (~0.3 s). Additive; drop the two
-- indexes to undo. Applied to production 2026-10-27. Run each statement on its own (CONCURRENTLY cannot
-- run inside a transaction).
create extension if not exists pg_trgm with schema extensions;
create index concurrently if not exists "BoardLightRow_title_trgm_idx" on "BoardLightRow" using gin (title extensions.gin_trgm_ops);
create index concurrently if not exists "BoardLightRow_companyName_trgm_idx" on "BoardLightRow" using gin ("companyName" extensions.gin_trgm_ops);
