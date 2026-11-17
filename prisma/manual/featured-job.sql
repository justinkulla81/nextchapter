-- Talent Hub phase 7: featured jobs (an organization's group sees them first). Additive only.
CREATE TABLE IF NOT EXISTS "FeaturedJob" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES "Institution"("id") ON DELETE CASCADE,
  "postingId" TEXT NOT NULL,
  "note" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "FeaturedJob_institutionId_postingId_key" ON "FeaturedJob"("institutionId", "postingId");
CREATE INDEX IF NOT EXISTS "FeaturedJob_institutionId_createdAt_idx" ON "FeaturedJob"("institutionId", "createdAt");
