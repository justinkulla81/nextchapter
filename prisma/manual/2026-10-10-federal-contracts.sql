-- Federal contract award summaries per company (USAspending). Additive, re-runnable.
-- RUN BEFORE the deploy that reads it.
CREATE TABLE IF NOT EXISTS "FederalContractSummary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "awards" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "topAgency" TEXT,
    "latestStart" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FederalContractSummary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FederalContractSummary_companyId_key" ON "FederalContractSummary"("companyId");
