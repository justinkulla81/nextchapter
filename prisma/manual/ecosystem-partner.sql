-- Talent Hub phase 6: the ecosystem directory, invitations and claims. Additive only.
CREATE TABLE IF NOT EXISTS "EcosystemPartner" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "Institution"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'OTHER',
  "website" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "refId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UNINVITED',
  "inviteToken" TEXT,
  "invitedAt" TIMESTAMP(3),
  "claimName" TEXT,
  "claimTitle" TEXT,
  "claimEmail" TEXT,
  "claimNote" TEXT,
  "emailDomainMatch" BOOLEAN,
  "commitments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "claimedAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "decidedBy" TEXT,
  "createdBy" TEXT NOT NULL,
  "isSampleData" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EcosystemPartner_inviteToken_key" ON "EcosystemPartner"("inviteToken");
CREATE UNIQUE INDEX IF NOT EXISTS "EcosystemPartner_institutionId_source_refId_key" ON "EcosystemPartner"("institutionId", "source", "refId");
CREATE INDEX IF NOT EXISTS "EcosystemPartner_institutionId_status_idx" ON "EcosystemPartner"("institutionId", "status");
