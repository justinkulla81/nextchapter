-- SuppressedSender: per-candidate "not part of my job search" senders (family,
-- school/activities, spam, non-work). Additive only (one enum, one table).
-- Apply by hand; never plain `prisma db push` on prod. Until it is applied the
-- code treats the table as empty (reads fail soft), so deploying first is safe.
DO $$ BEGIN
  CREATE TYPE "SuppressedSenderReason" AS ENUM ('FAMILY_FRIENDS', 'SCHOOL_ACTIVITIES', 'SPAM_BULK', 'NOT_WORK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "SuppressedSender" (
  "id"          TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "value"       TEXT NOT NULL,
  "isDomain"    BOOLEAN NOT NULL DEFAULT false,
  "reason"      "SuppressedSenderReason" NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "SuppressedSender_candidateId_value_key" ON "SuppressedSender"("candidateId","value");
CREATE INDEX IF NOT EXISTS "SuppressedSender_candidateId_idx" ON "SuppressedSender"("candidateId");
ALTER TABLE "SuppressedSender" ENABLE ROW LEVEL SECURITY;
