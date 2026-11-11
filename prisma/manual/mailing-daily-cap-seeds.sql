-- Daily send cap and seed-test inboxes for list mail. Additive; safe to re-run.
ALTER TABLE "MailingSettings" ADD COLUMN IF NOT EXISTS "dailyCap" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "MailingSettings" ADD COLUMN IF NOT EXISTS "seedEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "MailingSettings" SET "seedEmails" = ARRAY['justin.kulla@gmail.com'] WHERE "id" = 'singleton' AND cardinality("seedEmails") = 0;
