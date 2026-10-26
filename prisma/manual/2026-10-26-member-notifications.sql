-- The dashboard bell: MemberNotification. Additive, re-runnable. RUN BEFORE the deploy that reads it.
CREATE TABLE IF NOT EXISTS "MemberNotification" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "href" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "MemberNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MemberNotification_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MemberNotification_candidateId_dedupeKey_key" ON "MemberNotification"("candidateId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "MemberNotification_candidateId_readAt_createdAt_idx" ON "MemberNotification"("candidateId", "readAt", "createdAt");
