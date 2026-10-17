-- Candidate+ Verified evidence: imported review stats from other platforms,
-- and (later) reviews from NextChapter clients. Additive only (two new
-- tables). Apply by hand with a short lock_timeout; never `prisma db push`.
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "ExternalReviewStat" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "platform" TEXT NOT NULL,
  "platformLabel" TEXT,
  "profileUrl" TEXT NOT NULL,
  "rating" DOUBLE PRECISION NOT NULL,
  "reviewCount" INTEGER NOT NULL,
  "jobsCompleted" INTEGER,
  "screenshotUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SELF_REPORTED',
  "checkNote" TEXT,
  "checkedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "ExternalReviewStat_candidateId_idx" ON "ExternalReviewStat"("candidateId");
CREATE INDEX IF NOT EXISTS "ExternalReviewStat_status_idx" ON "ExternalReviewStat"("status");
ALTER TABLE "ExternalReviewStat" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "ClientReview" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "employerId" TEXT,
  "reviewerName" TEXT NOT NULL,
  "reviewerEmail" TEXT,
  "reviewerCompany" TEXT,
  "rating" DOUBLE PRECISION NOT NULL,
  "body" TEXT,
  "engagementTitle" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "ClientReview_candidateId_status_idx" ON "ClientReview"("candidateId", "status");
ALTER TABLE "ClientReview" ENABLE ROW LEVEL SECURITY;
