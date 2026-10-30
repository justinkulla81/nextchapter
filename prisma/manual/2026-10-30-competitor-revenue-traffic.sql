-- Competitor revenue and traffic as numbers the table can sort on. Additive only; apply by hand, never prisma db push.
ALTER TABLE "ProductCompetitor" ADD COLUMN IF NOT EXISTS "revenueUsd" DOUBLE PRECISION;
ALTER TABLE "ProductCompetitor" ADD COLUMN IF NOT EXISTS "monthlyVisits" INTEGER;
ALTER TABLE "ProductCompetitor" ADD COLUMN IF NOT EXISTS "trafficNote" TEXT;
