-- Secondary and background colors for an organization's brand (additive).
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "backgroundColor" TEXT;
