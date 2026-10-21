-- Personalization read-backs (2026-10-16): "Retuning your search", "What we know about you",
-- the board's "got smarter" line, and Job Search Daily's "What changed for you".
--
-- MemberMatchSnapshot: what a member's matching read (the profile fields relevance uses, as
--   JSON) and, when it was computed, how many jobs that gave them. 'baseline' rows are the
--   inputs just before a save that changes matching (no counts); 'retune' rows are the
--   recompute right after it (counts + the top reasons); 'daily' rows are Job Search Daily's
--   count, for the week-on-week trend. The retune's "before" is the baseline's inputs run
--   against today's jobs, so before and after are measured on the same board.
-- CandidateProfile.candidatePlusUnlockSeenAt: the one-time Candidate+ unlock screen was shown.
--
-- Additive only. Apply with a short lock_timeout before deploying the code; never `prisma db push`.

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "MemberMatchSnapshot" (
  "id"          TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "kind"        TEXT NOT NULL,
  "trigger"     TEXT,
  "inputs"      JSONB NOT NULL,
  "checked"     INTEGER,
  "relevant"    INTEGER,
  "strong"      INTEGER,
  "detail"      JSONB,
  "ms"          INTEGER,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberMatchSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MemberMatchSnapshot_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MemberMatchSnapshot_candidateId_createdAt_idx" ON "MemberMatchSnapshot"("candidateId", "createdAt");
ALTER TABLE "MemberMatchSnapshot" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "candidatePlusUnlockSeenAt" TIMESTAMP(3);
