-- Each workforce board's own bids / RFP / procurement page, found by crawling its site.
-- Additive only. procurementItems holds up to six solicitation lines seen on the page (leads, not a bid list).
ALTER TABLE "WorkforceBoard" ADD COLUMN IF NOT EXISTS "procurementUrl" TEXT;
ALTER TABLE "WorkforceBoard" ADD COLUMN IF NOT EXISTS "procurementKind" TEXT;
ALTER TABLE "WorkforceBoard" ADD COLUMN IF NOT EXISTS "procurementItems" JSONB;
ALTER TABLE "WorkforceBoard" ADD COLUMN IF NOT EXISTS "procurementCheckedAt" TIMESTAMP(3);
