-- Talent Hub phase 5: partner views (unlisted, read-only, revocable links to an organization's regional data). Additive only.
CREATE TABLE IF NOT EXISTS "PartnerView" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "Institution"("id") ON DELETE CASCADE,
  "token" TEXT NOT NULL,
  "partnerName" TEXT NOT NULL,
  "partnerKind" TEXT NOT NULL DEFAULT 'OTHER',
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "note" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "openCount" INTEGER NOT NULL DEFAULT 0,
  "lastOpenedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "isSampleData" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerView_token_key" ON "PartnerView"("token");
CREATE INDEX IF NOT EXISTS "PartnerView_institutionId_createdAt_idx" ON "PartnerView"("institutionId", "createdAt");
