-- AI skills (2026-10-17), from the AI-skills analysis (findings.md section 6).
--
-- 1. ExclusiveJobPosting: the AI skills a posting asks for, read by the crawler from the FULL
--    posting text (ncrawl/ai_skills.py; 24 items in 3 groups) and sent by import-jobs.py, plus
--    the AI tools and certifications it names. Backfilled with batched UPDATEs.
-- 2. WorkSample.aiDetails: the guided template answers for the three AI work-sample types
--    (src/lib/evidence/ai-work-samples.ts).
--
-- Additive only: columns with constant defaults or nullable (metadata-only, no rewrite).
-- Apply with a short lock_timeout.

SET lock_timeout = '5s';
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "aiSkillGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "aiSkillItems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "aiToolsNamed" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "aiCertsNamed" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "WorkSample" ADD COLUMN IF NOT EXISTS "aiDetails" JSONB;
