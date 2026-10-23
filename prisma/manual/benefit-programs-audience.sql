-- Direct-apply link and softer fit signals ("affinity": a faith, a heritage, a life stage) for ranking.
-- Additive only. Audience GATES stay in "segments"; affinity never hides or shows a row by itself.
ALTER TABLE "BenefitProgram" ADD COLUMN IF NOT EXISTS "applyUrl" TEXT;
ALTER TABLE "BenefitProgram" ADD COLUMN IF NOT EXISTS "affinity" TEXT[] NOT NULL DEFAULT '{}';
