-- The public name a workforce board goes by when it differs from CareerOneStop's official name. Additive. Applied 2026-11-17.
ALTER TABLE "WorkforceBoard" ADD COLUMN IF NOT EXISTS "knownAs" TEXT;
UPDATE "WorkforceBoard" SET "knownAs" = 'KentuckianaWorks' WHERE id = 'KY-247' AND "knownAs" IS NULL;
