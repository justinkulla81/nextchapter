-- Competitor watch free mode. Additive only; apply by hand, never prisma db push.
ALTER TABLE "CompetitorWatchSetting" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE "ProductCompetitor" ADD COLUMN IF NOT EXISTS "siteText" TEXT;
ALTER TABLE "ProductCompetitor" ADD COLUMN IF NOT EXISTS "siteHash" TEXT;
ALTER TABLE "ProductCompetitor" ADD COLUMN IF NOT EXISTS "siteLogos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ProductCompetitor" ADD COLUMN IF NOT EXISTS "siteReadAt" TIMESTAMP(3);
