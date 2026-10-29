-- The company layoff/buyout page asks where you stand, what you want next and what would help; the answers are kept on the lead.
-- Additive, every column has a default; safe to re-run.
ALTER TABLE "HomepageLead" ADD COLUMN IF NOT EXISTS "pageVariant" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HomepageLead" ADD COLUMN IF NOT EXISTS "answerKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HomepageLead" ADD COLUMN IF NOT EXISTS "nextStep" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HomepageLead" ADD COLUMN IF NOT EXISTS "helpPicked" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HomepageLead" ADD COLUMN IF NOT EXISTS "schoolUnitid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HomepageLead" ADD COLUMN IF NOT EXISTS "schoolName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HomepageLead" ADD COLUMN IF NOT EXISTS "joinCommunity" BOOLEAN NOT NULL DEFAULT false;
