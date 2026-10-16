-- Job dismiss reasons, learned preferences, member job flags, and market-size stats (2026-10-16).
--
-- TrackedJob (existing "Not interested" row per job) gets the reasons and an optional note.
-- JobDismissPreference: what the board learned from dismissals, per member — a company
--   hidden, an industry / title / level / location moved down (or hidden once the member
--   says "Hide all"), a pay floor. Undo sets undoneAt; nothing is deleted.
-- JobPostingFlag: a member said a job looks like a ghost job, too good to be true, or has
--   red flags — feeds ghost risk (src/lib/jobs/ghost-risk.ts) and the admin review page.
-- MarketTargetStat: nightly counts per function x sub-function x level band x industry
--   bucket x geography (open now, opened and closed in the recent and prior windows), for
--   the market-size prompts (src/lib/market/market-size.ts). '' = unknown / none.
--
-- Additive only. Apply with a short lock_timeout before deploying the code; never `prisma db push`.

SET lock_timeout = '5s';

ALTER TABLE "TrackedJob"
  ADD COLUMN IF NOT EXISTS "dismissReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "dismissNote" TEXT;

CREATE TABLE IF NOT EXISTS "JobDismissPreference" (
  "id"          TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "kind"        TEXT NOT NULL,
  "value"       TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "count"       INTEGER NOT NULL DEFAULT 0,
  "action"      TEXT NOT NULL DEFAULT 'downweight',
  "askedAt"     TIMESTAMP(3),
  "undoneAt"    TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobDismissPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobDismissPreference_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobDismissPreference_candidateId_kind_value_key" ON "JobDismissPreference"("candidateId", "kind", "value");

CREATE TABLE IF NOT EXISTS "JobPostingFlag" (
  "id"          TEXT NOT NULL,
  "postingId"   TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "kind"        TEXT NOT NULL,
  "note"        TEXT,
  "reviewedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobPostingFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobPostingFlag_postingId_candidateId_kind_key" ON "JobPostingFlag"("postingId", "candidateId", "kind");
CREATE INDEX IF NOT EXISTS "JobPostingFlag_kind_createdAt_idx" ON "JobPostingFlag"("kind", "createdAt");

CREATE TABLE IF NOT EXISTS "MarketTargetStat" (
  "fn"           TEXT NOT NULL,
  "subFunction"  TEXT NOT NULL,
  "band"         TEXT NOT NULL,
  "industry"     TEXT NOT NULL,
  "geo"          TEXT NOT NULL,
  "openNow"      INTEGER NOT NULL DEFAULT 0,
  "newRecent"    INTEGER NOT NULL DEFAULT 0,
  "newPrior"     INTEGER NOT NULL DEFAULT 0,
  "closedRecent" INTEGER NOT NULL DEFAULT 0,
  "closedPrior"  INTEGER NOT NULL DEFAULT 0,
  "computedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketTargetStat_pkey" PRIMARY KEY ("fn", "subFunction", "band", "industry", "geo")
);

ALTER TABLE "JobDismissPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobPostingFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketTargetStat" ENABLE ROW LEVEL SECURITY;
