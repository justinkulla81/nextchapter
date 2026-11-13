-- Warm-first sending: warm recipients go first; people with no warm signal share a smaller daily cap. Additive; safe to re-run.
ALTER TABLE "MailingSettings" ADD COLUMN IF NOT EXISTS "coldDailyCap" INTEGER NOT NULL DEFAULT 150;
ALTER TABLE "MailingEdition" ADD COLUMN IF NOT EXISTS "warmMarkedAt" TIMESTAMP(3);
ALTER TABLE "MailingEditionRecipient" ADD COLUMN IF NOT EXISTS "warm" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MailingSettings" ADD COLUMN IF NOT EXISTS "coldFromEmail" TEXT NOT NULL DEFAULT '';
