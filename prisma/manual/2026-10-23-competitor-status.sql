-- Competitor cards: whether the company still operates, what happened, what we can learn, how we could partner, and its market.
-- Additive columns; run before deploying (applied to production 2026-10-23).
ALTER TABLE "ProductCompetitor"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "statusNote" TEXT,
  ADD COLUMN IF NOT EXISTS "lessons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "partnerIdea" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT;
