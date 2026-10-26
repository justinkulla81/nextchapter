-- Job alert emails: double opt-in, the alert cursor and the inferred journey on HomepageLead.
-- Additive, re-runnable. RUN BEFORE the deploy that reads it.
ALTER TABLE "HomepageLead" ADD COLUMN IF NOT EXISTS "confirmSentAt" TIMESTAMP(3);
ALTER TABLE "HomepageLead" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "HomepageLead" ADD COLUMN IF NOT EXISTS "lastAlertAt" TIMESTAMP(3);
ALTER TABLE "HomepageLead" ADD COLUMN IF NOT EXISTS "journeySlug" TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "HomepageLead_kind_confirmedAt_idx" ON "HomepageLead"("kind", "confirmedAt");
