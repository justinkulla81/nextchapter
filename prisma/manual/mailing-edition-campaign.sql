-- Layoff outreach campaigns: the emails the app sends to a layoff's HR, Rapid Response, workforce board, job center and
-- economic development contacts are MailingEditions tagged with the layoff (warnNoticeId), who they are for (audience) and
-- the campaign ('layoff_outreach'), so opens, clicks, replies and unsubscribes can be read by layoff and by type.
-- bccEmail is copied on every send. Additive; safe to re-run.
ALTER TABLE "MailingEdition" ADD COLUMN IF NOT EXISTS "campaign" TEXT;
ALTER TABLE "MailingEdition" ADD COLUMN IF NOT EXISTS "warnNoticeId" TEXT;
ALTER TABLE "MailingEdition" ADD COLUMN IF NOT EXISTS "audience" TEXT;
ALTER TABLE "MailingEdition" ADD COLUMN IF NOT EXISTS "bccEmail" TEXT;
CREATE INDEX IF NOT EXISTS "MailingEdition_campaign_warnNoticeId_idx" ON "MailingEdition" ("campaign", "warnNoticeId");
