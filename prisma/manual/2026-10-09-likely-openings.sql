-- Likely openings: SEC EDGAR signals (8-K Item 5.02, Form D) that a senior role is about to open. Additive.
CREATE TYPE "LikelyOpeningSignalType" AS ENUM ('EXEC_DEPARTURE', 'EXEC_APPOINTMENT', 'FUNDING_RAISE');

CREATE TABLE "LikelyOpening" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyNameNormalized" TEXT NOT NULL,
    "cik" TEXT NOT NULL,
    "signalType" "LikelyOpeningSignalType" NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filingDate" TIMESTAMP(3) NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "filingUrl" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "amountRaised" DOUBLE PRECISION,
    "industry" TEXT,
    "location" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LikelyOpening_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LikelyOpening_companyNameNormalized_idx" ON "LikelyOpening"("companyNameNormalized");
CREATE INDEX "LikelyOpening_expiresAt_filingDate_idx" ON "LikelyOpening"("expiresAt", "filingDate");
CREATE UNIQUE INDEX "LikelyOpening_accessionNumber_signalType_key" ON "LikelyOpening"("accessionNumber", "signalType");
ALTER TABLE "LikelyOpening" ENABLE ROW LEVEL SECURITY;
