-- Talent Hub phase 8: connected employer job boards (Greenhouse, Lever, Ashby). Additive only.
CREATE TABLE IF NOT EXISTS "GroupJobFeed" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "Institution"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "locationFilter" TEXT,
  "includeRemote" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSeen" INTEGER NOT NULL DEFAULT 0,
  "lastAdded" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdBy" TEXT NOT NULL,
  "isSampleData" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupJobFeed_institutionId_provider_token_key" ON "GroupJobFeed"("institutionId", "provider", "token");
CREATE INDEX IF NOT EXISTS "GroupJobFeed_institutionId_createdAt_idx" ON "GroupJobFeed"("institutionId", "createdAt");
