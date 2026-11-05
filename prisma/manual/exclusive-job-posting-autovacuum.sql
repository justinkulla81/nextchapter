-- Applied to production 2026-11-04. The table churns constantly (crawler imports), so autovacuum at the
-- default 20% scale factor left only ~29% of pages all-visible and index-only counts read the heap (~14s).
-- Revert: ALTER TABLE "ExclusiveJobPosting" RESET (autovacuum_vacuum_scale_factor);
ALTER TABLE "ExclusiveJobPosting" SET (autovacuum_vacuum_scale_factor = 0.02);
