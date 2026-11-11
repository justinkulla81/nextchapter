-- Opens of list emails as Resend reports them (address, browser, time), saved by the Resend webhook so a machine's open
-- (a mail scanner, Apple Mail Privacy Protection) is not counted as a person's. Additive; safe to re-run.
CREATE TABLE IF NOT EXISTS "MailingOpenEvent" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "ip" TEXT NOT NULL DEFAULT '',
  "userAgent" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL,
  "bot" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailingOpenEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MailingOpenEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "MailingEditionRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MailingOpenEvent_recipientId_openedAt_ip_key" ON "MailingOpenEvent"("recipientId", "openedAt", "ip");
CREATE INDEX IF NOT EXISTS "MailingOpenEvent_ip_openedAt_idx" ON "MailingOpenEvent"("ip", "openedAt");
ALTER TABLE "MailingOpenEvent" ENABLE ROW LEVEL SECURITY;
