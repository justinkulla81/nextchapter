-- What a buyer's own site says it buys and who to call (workforce boards, EDA districts, local EDOs, state
-- workforce agencies). New table, additive; run before deploying code that reads it.
CREATE TABLE IF NOT EXISTS "BuyerCrawl" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "website" TEXT,
  "crawledAt" TIMESTAMP(3) NOT NULL,
  "httpStatus" INTEGER,
  "error" TEXT,
  "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
  "procurementUrl" TEXT,
  "solicitations" JSONB,
  "solicitationCount" INTEGER NOT NULL DEFAULT 0,
  "recentCount" INTEGER NOT NULL DEFAULT 0,
  "people" JSONB,
  "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "systems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "policy" JSONB,
  "rapidResponseNote" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BuyerCrawl_kind_state_idx" ON "BuyerCrawl" ("kind", "state");
CREATE INDEX IF NOT EXISTS "BuyerCrawl_recentCount_idx" ON "BuyerCrawl" ("recentCount");
