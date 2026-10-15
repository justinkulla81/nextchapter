-- Pivot paths (src/lib/pivots): additive tables. Applied by hand (never prisma db push from a branch).
-- CreateTable
CREATE TABLE IF NOT EXISTS "PivotPreference" (
    "candidateId" TEXT NOT NULL,
    "peopleEnergy" TEXT,
    "peopleEnergyAt" TIMESTAMP(3),
    "dismissedTargets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PivotPreference_pkey" PRIMARY KEY ("candidateId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PivotMarketStat" (
    "id" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "geo" TEXT NOT NULL,
    "band" TEXT NOT NULL,
    "openNow" INTEGER NOT NULL,
    "lowCompetitionOpen" INTEGER NOT NULL DEFAULT 0,
    "new30" INTEGER NOT NULL DEFAULT 0,
    "prior30" INTEGER NOT NULL DEFAULT 0,
    "new90" INTEGER NOT NULL DEFAULT 0,
    "prior90" INTEGER NOT NULL DEFAULT 0,
    "payP50" INTEGER,
    "paySample" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PivotMarketStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PivotMarketStat_geo_band_idx" ON "PivotMarketStat"("geo", "band");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PivotMarketStat_roleKey_geo_band_key" ON "PivotMarketStat"("roleKey", "geo", "band");

-- AddForeignKey
ALTER TABLE "PivotPreference" ADD CONSTRAINT "PivotPreference_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Server-only tables (Prisma uses the service connection); no client access.
ALTER TABLE "PivotPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PivotMarketStat" ENABLE ROW LEVEL SECURITY;
