-- RFP and grant evaluator / completer (docs/funding/rfp-evaluator.md). Additive only.
-- BidCompanyFact: NextChapter's own facts a response needs (one row per fact key, keys defined in src/lib/bid-evaluator/facts.ts).
-- BidContentBlock: reusable answers (organization description, approach...), keyed the same way.
-- BidEvaluation: one row per evaluated opportunity (a federal notice, a board bid, or a grants-pipeline row).

CREATE TABLE IF NOT EXISTS "BidCompanyFact" (
  "key"       TEXT PRIMARY KEY,
  "value"     TEXT NOT NULL,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BidContentBlock" (
  "key"       TEXT PRIMARY KEY,
  "body"      TEXT NOT NULL,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BidEvaluation" (
  "id"          TEXT PRIMARY KEY,
  "sourceKind"  TEXT NOT NULL,
  "sourceId"    TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "url"         TEXT NOT NULL,
  "state"       TEXT,
  "issuer"      TEXT,
  "docUrls"     TEXT[] NOT NULL DEFAULT '{}',
  "textChars"   INTEGER NOT NULL DEFAULT 0,
  "fetchError"  TEXT,
  "profile"     JSONB,
  "result"      JSONB,
  "verdict"     TEXT,
  "route"       TEXT,
  "score"       INTEGER,
  "dueAt"       TIMESTAMP(3),
  "evaluatedAt" TIMESTAMP(3),
  "evaluatedBy" TEXT,
  "draft"       JSONB,
  "draftedAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BidEvaluation_sourceKind_sourceId_key" ON "BidEvaluation" ("sourceKind", "sourceId");
CREATE INDEX IF NOT EXISTS "BidEvaluation_verdict_score_idx" ON "BidEvaluation" ("verdict", "score");
