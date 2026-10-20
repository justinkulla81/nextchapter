-- LinkedInAdminConnection + LinkedInPostDraft.postUrn. Additive only.
ALTER TABLE "LinkedInPostDraft" ADD COLUMN IF NOT EXISTS "postUrn" TEXT;
CREATE TABLE IF NOT EXISTS "LinkedInAdminConnection" (
  "id" TEXT PRIMARY KEY,
  "adminEmail" TEXT NOT NULL UNIQUE,
  "accessToken" TEXT NOT NULL,
  "personUrn" TEXT NOT NULL,
  "memberName" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disconnectedAt" TIMESTAMP(3)
);
ALTER TABLE "LinkedInAdminConnection" ENABLE ROW LEVEL SECURITY;
