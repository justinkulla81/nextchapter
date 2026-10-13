-- NewsletterMessage: the Gmail messages the newsletter sweep has already read
-- (src/lib/research/newsletter-sweep.ts), so an issue is processed once whether or
-- not it was opened first. The Google connection cannot mark mail read (it has no
-- modify scope), so this table is the memory. Additive only (one new table).
-- Apply by hand; never plain `prisma db push` on prod. Run BEFORE the deploy that
-- reads it; until then the newsletter pass fails and the alert sweep is unaffected.
CREATE TABLE IF NOT EXISTS "NewsletterMessage" (
  "messageId"   TEXT PRIMARY KEY,
  "events"      INTEGER NOT NULL DEFAULT 0,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NewsletterMessage_processedAt_idx" ON "NewsletterMessage"("processedAt");
ALTER TABLE "NewsletterMessage" ENABLE ROW LEVEL SECURITY;
