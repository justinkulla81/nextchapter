-- "Make a copy" on an edition: copies point at the first edition of their group.
ALTER TABLE "MailingEdition" ADD COLUMN IF NOT EXISTS "versionOfId" TEXT;
DO $$ BEGIN
  ALTER TABLE "MailingEdition" ADD CONSTRAINT "MailingEdition_versionOfId_fkey"
    FOREIGN KEY ("versionOfId") REFERENCES "MailingEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "MailingEdition_versionOfId_idx" ON "MailingEdition"("versionOfId");
