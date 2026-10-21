-- AI metrics (2026-10-20): two defensible counts and a live AI pay premium.
--
-- 1. ExclusiveJobPosting, from the crawler (ncrawl/ai_skills.ai_profile via scripts/ai_tag_jobs.py,
--    sent by import-jobs.py inside ai_skills_json):
--    aiExposed      substantive AI in the role: a specific AI skill, an AI/ML title term, a data & AI
--                   role whose role text mentions AI, or an AI tool named in the role text.
--    aiExposureWhy  which of those rules fired: skill | title | function | tools.
--    aiMention      any AI word anywhere in the text (the pay comparison's no-AI baseline is
--                   full-text rows with aiMention false). Null = not read yet.
--    aiBasis        full | twin | excerpt: what text the AI fields were read from. Null = not read yet.
-- 2. AiMarketSnapshot: the weekly recompute of the AI-skill share, pay premium (raw and
--    like-for-like) and top skills / tools per function x level, from the live board
--    (src/lib/skills/ai-market-live.ts, cron /api/cron/ai-market).
--
-- Additive only: nullable columns or constant defaults (metadata-only, no rewrite), a new table,
-- and a partial index (two seconds inside the MCP's transaction, like 2026-10-17-ai-view-index.sql).

SET lock_timeout = '5s';
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "aiExposed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "aiExposureWhy" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "aiMention" BOOLEAN;
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "aiBasis" TEXT;

CREATE TABLE IF NOT EXISTS "AiMarketSnapshot" (
  "id" TEXT NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data" JSONB NOT NULL,
  CONSTRAINT "AiMarketSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiMarketSnapshot_computedAt_idx" ON "AiMarketSnapshot" ("computedAt");
ALTER TABLE "AiMarketSnapshot" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "ExclusiveJobPosting_ai_exposed_ids_idx"
  ON "ExclusiveJobPosting" (id) WHERE "aiExposed";
