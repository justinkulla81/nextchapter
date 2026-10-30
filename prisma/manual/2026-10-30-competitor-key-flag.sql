-- Key competitor flag on the Competitors page. Additive only; apply by hand, never prisma db push.
ALTER TABLE "ProductCompetitor" ADD COLUMN IF NOT EXISTS "keyCompetitor" BOOLEAN NOT NULL DEFAULT false;
