-- Senior Monday brief (src/lib/senior-brief, /api/cron/senior-brief). Additive only: two columns on
-- CandidateProfile and one new table. Apply by hand; never plain `prisma db push` on prod.
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "seniorBriefOptedOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "seniorBriefPausedUntil" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SeniorBriefDraft" (
  "id"           TEXT PRIMARY KEY,
  "candidateId"  TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "weekKey"      TEXT NOT NULL,
  "isTest"       BOOLEAN NOT NULL DEFAULT false,
  "itemKind"     TEXT NOT NULL,
  "contactId"    TEXT,
  "contactName"  TEXT,
  "companyName"  TEXT,
  "toEmail"      TEXT,
  "subject"      TEXT,
  "body"         TEXT,
  "model"        TEXT,
  "inputTokens"  INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "estCostUsd"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"       TEXT NOT NULL DEFAULT 'DRAFTING',
  "emailedAt"    TIMESTAMP(3),
  "openedAt"     TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "SeniorBriefDraft_candidateId_weekKey_key" ON "SeniorBriefDraft"("candidateId","weekKey");
CREATE INDEX IF NOT EXISTS "SeniorBriefDraft_createdAt_idx" ON "SeniorBriefDraft"("createdAt");
