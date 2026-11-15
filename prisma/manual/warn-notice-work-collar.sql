-- Applied to production 2026-11-13. Additive, nullable.
ALTER TABLE "WarnNotice" ADD COLUMN IF NOT EXISTS "workCollar" text;
