-- Clicks on list-email links as Resend reports them (address, browser, time), saved by the Resend webhook.
-- Additive: a new table. The code is fail-soft if it is missing (a click is simply not saved).
CREATE TABLE IF NOT EXISTS "MailingClickEvent" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "link" TEXT NOT NULL DEFAULT '',
  "clickedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailingClickEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MailingClickEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "MailingEditionRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MailingClickEvent_recipientId_clickedAt_link_key" ON "MailingClickEvent"("recipientId", "clickedAt", "link");
CREATE INDEX IF NOT EXISTS "MailingClickEvent_ip_clickedAt_idx" ON "MailingClickEvent"("ip", "clickedAt");
ALTER TABLE "MailingClickEvent" ENABLE ROW LEVEL SECURITY;
