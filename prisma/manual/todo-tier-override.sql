-- Lets a to-do's priority (P000 / P00 / P0 / Auto) be set by hand. Additive; safe to re-run.
ALTER TABLE "CrmTask" ADD COLUMN IF NOT EXISTS "tierOverride" TEXT;
