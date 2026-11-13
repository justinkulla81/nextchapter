-- When the layoff outreach sweep looked at a notice (smaller layoffs that never got a full alert), so each is looked at once.
-- Additive; safe to re-run.
ALTER TABLE "WarnNotice" ADD COLUMN IF NOT EXISTS "outreachCheckedAt" TIMESTAMP(3);
