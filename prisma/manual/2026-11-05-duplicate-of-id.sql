-- The board row that replaced a collapsed third-party copy (ExclusiveJobPosting.duplicateOfId). Additive, nullable, no default.
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "duplicateOfId" TEXT;
-- Undo a bad batch (example): UPDATE "ExclusiveJobPosting" SET "archivedAt" = NULL, "closeReason" = NULL, "duplicateOfId" = NULL
--   WHERE "closeReason" = 'duplicate' AND "duplicateOfId" IS NOT NULL AND "archivedAt" >= '<start of the bad run>';
