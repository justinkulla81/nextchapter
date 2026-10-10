-- Offered wages from public H-1B (DOL LCA) filings, per company and occupation.
-- Additive and re-runnable. RUN BEFORE the deploy that reads it.
CREATE TABLE IF NOT EXISTS "OfferedWageSummary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "socCode" TEXT NOT NULL,
    "socTitle" TEXT NOT NULL,
    "filings" INTEGER NOT NULL,
    "wageP25" INTEGER NOT NULL,
    "wageMedian" INTEGER NOT NULL,
    "wageP75" INTEGER NOT NULL,
    "topWageLevel" TEXT,
    "topState" TEXT,
    "latestDecision" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'DOL_LCA',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferedWageSummary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OfferedWageSummary_companyId_socCode_source_key" ON "OfferedWageSummary"("companyId", "socCode", "source");
CREATE INDEX IF NOT EXISTS "OfferedWageSummary_companyId_idx" ON "OfferedWageSummary"("companyId");
