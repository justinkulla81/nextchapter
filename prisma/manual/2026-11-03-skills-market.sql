-- Skills market: a daily snapshot of the skills live postings ask for (by industry, function, state, level),
-- and the skills a member watches. Additive. src/lib/skills/market-server.ts, cron /api/cron/skills-market.
CREATE TABLE IF NOT EXISTS "SkillMarketSnapshot" (
  "id" TEXT PRIMARY KEY,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "data" JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS "SkillMarketSnapshot_computedAt_idx" ON "SkillMarketSnapshot"("computedAt");

CREATE TABLE IF NOT EXISTS "SkillWatch" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "skillSlug" TEXT NOT NULL,
  "skillName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "SkillWatch_candidateId_skillSlug_key" ON "SkillWatch"("candidateId", "skillSlug");
CREATE INDEX IF NOT EXISTS "SkillWatch_skillSlug_idx" ON "SkillWatch"("skillSlug");
