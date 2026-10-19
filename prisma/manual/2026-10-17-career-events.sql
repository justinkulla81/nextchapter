-- CareerEvent: the member's own additions and corrections to their career story.
-- Additive (one new table). Private to the member: RLS on with no policies, same as the other
-- member-only tables; the app reads it through the service role. Apply by hand; never plain
-- `prisma db push` on prod.
CREATE TABLE IF NOT EXISTS "CareerEvent" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "detail" TEXT,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "reason" TEXT,
  "sourceRef" TEXT,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "CareerEvent_candidateId_idx" ON "CareerEvent"("candidateId");
CREATE UNIQUE INDEX IF NOT EXISTS "CareerEvent_candidateId_sourceRef_key" ON "CareerEvent"("candidateId", "sourceRef");
ALTER TABLE "CareerEvent" ENABLE ROW LEVEL SECURITY;
