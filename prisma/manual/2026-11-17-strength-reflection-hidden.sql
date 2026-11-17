-- Find your strengths: a member can hide one strength from their Dossier. Additive.
ALTER TABLE "StrengthReflection" ADD COLUMN IF NOT EXISTS "hiddenFromEmployers" BOOLEAN NOT NULL DEFAULT false;
