-- 2026-11-05: a member can turn off the officer-change news in their role feed and weekly digest.
-- Additive and nullable, so code that does not read it is unaffected; apply before the deploy that does.
ALTER TABLE "CommunityMembership" ADD COLUMN IF NOT EXISTS "turnoverMutedAt" TIMESTAMP(3);
-- Revert: ALTER TABLE "CommunityMembership" DROP COLUMN IF EXISTS "turnoverMutedAt";
