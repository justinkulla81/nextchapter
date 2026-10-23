-- Job tracker notes (2026-10-23, Teal parity): the member's own notes on a job in My jobs —
-- free-text notes, an excitement rating (1-5), a follow-up date, an application checklist
-- (JSON: { resume_tailored, cover_note, referral_asked, follow_up_sent } -> ISO date when ticked),
-- the contacts who can help (SupportNetworkContact ids) and, for a job saved from another site,
-- the pasted posting text for the keyword match.
--
-- itemKey is MyJobItem.key (src/lib/jobs/my-jobs-data.ts): 'job_board:<id>', 'surfaced:<id>',
-- 'external:<hash>', 'application:<JobPosting.id>' or 'posting:<JobPosting.id>'. title and
-- companyName are a snapshot so Job Search Daily can name a due follow-up without rebuilding My jobs.
--
-- Additive only: a new table. Apply with a short lock_timeout before deploying the code; never
-- `prisma db push`.

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "JobTrackerNote" (
  "id"             TEXT NOT NULL,
  "candidateId"    TEXT NOT NULL,
  "itemKey"        TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "companyName"    TEXT,
  "notes"          TEXT,
  "excitement"     INTEGER,
  "followUpAt"     TIMESTAMP(3),
  "followUpDoneAt" TIMESTAMP(3),
  "checklist"      JSONB NOT NULL DEFAULT '{}'::jsonb,
  "contactIds"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "jobText"        TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobTrackerNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobTrackerNote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "JobTrackerNote_candidateId_itemKey_key" ON "JobTrackerNote"("candidateId", "itemKey");
CREATE INDEX IF NOT EXISTS "JobTrackerNote_followUpAt_idx" ON "JobTrackerNote"("followUpAt") WHERE "followUpDoneAt" IS NULL;

ALTER TABLE "JobTrackerNote" ENABLE ROW LEVEL SECURITY;
