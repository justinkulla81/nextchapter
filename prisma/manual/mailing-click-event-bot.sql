-- Marks a list-email click made by a mail scanner rather than a person. Additive; safe to re-run.
ALTER TABLE "MailingClickEvent" ADD COLUMN IF NOT EXISTS "bot" BOOLEAN NOT NULL DEFAULT false;
