-- Talent Hub phase 11: partner accounts (a person at a confirmed ecosystem partner signs in to its own page). Additive only.
CREATE TABLE IF NOT EXISTS "EcosystemPartnerContact" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "Institution"("id") ON DELETE CASCADE,
  "partnerId" TEXT NOT NULL REFERENCES "EcosystemPartner"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "inviteToken" TEXT,
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "isSampleData" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EcosystemPartnerContact_inviteToken_key" ON "EcosystemPartnerContact"("inviteToken");
CREATE UNIQUE INDEX IF NOT EXISTS "EcosystemPartnerContact_partnerId_email_key" ON "EcosystemPartnerContact"("partnerId", "email");
CREATE INDEX IF NOT EXISTS "EcosystemPartnerContact_userId_idx" ON "EcosystemPartnerContact"("userId");
CREATE INDEX IF NOT EXISTS "EcosystemPartnerContact_institutionId_idx" ON "EcosystemPartnerContact"("institutionId");
ALTER TABLE "PartnerView" ADD COLUMN IF NOT EXISTS "ecosystemPartnerId" TEXT REFERENCES "EcosystemPartner"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "PartnerView_ecosystemPartnerId_idx" ON "PartnerView"("ecosystemPartnerId");
