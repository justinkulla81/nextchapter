-- SearchSupporter + SupporterCheer. Additive only (two new tables). Apply by
-- hand; never plain `prisma db push` on prod.
CREATE TABLE IF NOT EXISTS "SearchSupporter" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "lastDigestAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "SearchSupporter_candidateId_email_key" ON "SearchSupporter"("candidateId", "email");
CREATE INDEX IF NOT EXISTS "SearchSupporter_candidateId_idx" ON "SearchSupporter"("candidateId");
CREATE TABLE IF NOT EXISTS "SupporterCheer" (
  "id" TEXT PRIMARY KEY,
  "supporterId" TEXT NOT NULL REFERENCES "SearchSupporter"("id") ON DELETE CASCADE,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seenAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "SupporterCheer_supporterId_createdAt_idx" ON "SupporterCheer"("supporterId", "createdAt");
ALTER TABLE "SearchSupporter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupporterCheer" ENABLE ROW LEVEL SECURITY;
