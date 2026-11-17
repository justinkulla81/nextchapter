-- Talent Hub phase 2: layoff response steps, funding applications, and the funding link on a response. Additive only.
-- Apply before the deploy that reads them (the code is also fail-soft).
CREATE TABLE IF NOT EXISTS "RapidResponseStep" (
  "id" TEXT PRIMARY KEY,
  "rapidResponseId" TEXT NOT NULL REFERENCES "RapidResponse"("id") ON DELETE CASCADE,
  "key" TEXT NOT NULL,
  "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "doneBy" TEXT NOT NULL,
  "note" TEXT,
  "isSampleData" BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS "RapidResponseStep_rapidResponseId_key_key" ON "RapidResponseStep"("rapidResponseId", "key");

CREATE TABLE IF NOT EXISTS "FundingApplication" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "Institution"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "funder" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CONSIDERING',
  "amountRequested" INTEGER,
  "amountAwarded" INTEGER,
  "matchRequired" INTEGER,
  "matchCommitted" INTEGER,
  "dueDate" TIMESTAMP(3),
  "partners" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "isSampleData" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FundingApplication_institutionId_status_idx" ON "FundingApplication"("institutionId", "status");

ALTER TABLE "RapidResponse" ADD COLUMN IF NOT EXISTS "fundingApplicationId" TEXT;
