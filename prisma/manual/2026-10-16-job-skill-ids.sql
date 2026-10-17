-- O*NET skill ids on board jobs (2026-10-16): the O*NET skills and tools (Skill.id, through the
-- SkillAlias layer) a posting's title, description and listed skills name — a far wider
-- vocabulary than the ~150 terms in ExclusiveJobPosting.skills. Set at import from the full
-- description and backfilled from the stored excerpt (scripts/careers/backfill-job-skill-ids.ts).
-- The board's skills criterion compares them with the member's skills matrix mapped through
-- the same aliases (src/lib/jobs/relevance.ts).
--
-- Additive only: a column with a constant default (metadata-only). Apply with a short lock_timeout.

SET lock_timeout = '5s';
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "skillIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
