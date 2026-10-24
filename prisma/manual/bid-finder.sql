-- Bid finder: (1) federal awards (USAspending.gov) won by competitors, (2) open bids read from
-- workforce boards' own procurement pages. Additive only: three new tables, nothing existing is touched.
-- Apply by hand; never plain `prisma db push` on prod.
CREATE TABLE IF NOT EXISTS "CompetitorAward" (
  "id"            TEXT PRIMARY KEY,                -- "<awardKey>:<competitorName>"
  "competitorName" TEXT NOT NULL,
  "competitorId"  TEXT,                            -- ProductCompetitor.id when it is one of ours
  "recipientName" TEXT NOT NULL,                   -- name exactly as USAspending has it
  "kind"          TEXT NOT NULL,                   -- CONTRACT | GRANT
  "confidence"    TEXT NOT NULL DEFAULT 'EXACT',   -- EXACT | REVIEW (one-word name: could be another company)
  "awardKey"      TEXT NOT NULL,                   -- USAspending generated_internal_id
  "awardId"       TEXT,
  "description"   TEXT,
  "agency"        TEXT,
  "subAgency"     TEXT,
  "amount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startDate"     TIMESTAMP(3),
  "endDate"       TIMESTAMP(3),
  "url"           TEXT NOT NULL,
  "firstSeenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorAward_awardKey_competitorName_key" ON "CompetitorAward"("awardKey","competitorName");
CREATE INDEX IF NOT EXISTS "CompetitorAward_competitorName_idx" ON "CompetitorAward"("competitorName");
CREATE INDEX IF NOT EXISTS "CompetitorAward_firstSeenAt_idx" ON "CompetitorAward"("firstSeenAt");

CREATE TABLE IF NOT EXISTS "CompetitorAwardCheck" (
  "competitorName" TEXT PRIMARY KEY,
  "checkedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "awardsFound"   INTEGER NOT NULL DEFAULT 0,
  "error"         TEXT
);

CREATE TABLE IF NOT EXISTS "BoardBid" (
  "id"          TEXT PRIMARY KEY,                  -- sha1(boardId + normalised title), first 24 hex
  "boardId"     TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "url"         TEXT NOT NULL,                     -- the bid's own link when the page has one, else the procurement page
  "pageUrl"     TEXT NOT NULL,
  "deadline"    TIMESTAMP(3),
  "deadlineText" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'OPEN',      -- OPEN | CLOSED | GONE (no longer on the page)
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BoardBid_boardId_idx" ON "BoardBid"("boardId");
CREATE INDEX IF NOT EXISTS "BoardBid_status_deadline_idx" ON "BoardBid"("status","deadline");
CREATE INDEX IF NOT EXISTS "BoardBid_firstSeenAt_idx" ON "BoardBid"("firstSeenAt");

-- When each board's procurement page was last read, and what that read found.
CREATE TABLE IF NOT EXISTS "BoardBidCheck" (
  "boardId"   TEXT PRIMARY KEY,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "outcome"   TEXT NOT NULL,                       -- ok | no_page | unreachable | blocked | robots
  "bidsFound" INTEGER NOT NULL DEFAULT 0,
  "note"      TEXT
);
