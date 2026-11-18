-- Workforce Hub: who is in on a funding application, in what role, and the match each partner commits. Additive.
CREATE TABLE IF NOT EXISTS "FundingPartnerCommitment" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "partnerId" TEXT,
  "partnerName" TEXT NOT NULL,
  "partnerKind" TEXT NOT NULL DEFAULT 'OTHER',
  "role" TEXT NOT NULL DEFAULT 'PARTNER',
  "amount" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ASKED',
  "note" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FundingPartnerCommitment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FundingPartnerCommitment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FundingPartnerCommitment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FundingApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FundingPartnerCommitment_applicationId_idx" ON "FundingPartnerCommitment"("applicationId");
CREATE INDEX IF NOT EXISTS "FundingPartnerCommitment_institutionId_idx" ON "FundingPartnerCommitment"("institutionId");
