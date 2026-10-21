-- WarnNotice alert state: hold the layoff alert email until the contacts are populated. Additive only.
ALTER TABLE "WarnNotice" ADD COLUMN IF NOT EXISTS "alertSentAt" TIMESTAMP(3);
ALTER TABLE "WarnNotice" ADD COLUMN IF NOT EXISTS "alertHeldAt" TIMESTAMP(3);
ALTER TABLE "WarnNotice" ADD COLUMN IF NOT EXISTS "alertGaveUpAt" TIMESTAMP(3);
