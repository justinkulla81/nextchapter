-- More journeys (entrepreneur, happy with fractional work, taking time off), an
-- automatic journey change source, the win-back email kind, and culture fit.
-- Additive and re-runnable.
-- (ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older Postgres.)
ALTER TYPE "JourneyType" ADD VALUE IF NOT EXISTS 'ENTREPRENEUR';
ALTER TYPE "JourneyType" ADD VALUE IF NOT EXISTS 'FRACTIONAL';
ALTER TYPE "JourneyType" ADD VALUE IF NOT EXISTS 'TIME_OFF';
ALTER TYPE "JourneyChangeSource" ADD VALUE IF NOT EXISTS 'AUTOMATIC';
ALTER TYPE "CandidateEmailKey" ADD VALUE IF NOT EXISTS 'WIN_BACK';
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "cultureFit" JSONB;
