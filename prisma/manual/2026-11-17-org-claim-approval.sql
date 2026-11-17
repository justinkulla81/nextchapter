-- A verified claim for an organization type with a free workspace (college, workforce board, nonprofit, foundation,
-- workforce provider) waits for NextChapter to approve it before the workspace is created (owner decision 2026-11-17).
-- Additive and safe to re-run.
ALTER TABLE "OrgClaim" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "OrgClaim" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "OrgClaim" ADD COLUMN IF NOT EXISTS "declinedAt" TIMESTAMP(3);
ALTER TABLE "OrgClaim" ADD COLUMN IF NOT EXISTS "declinedBy" TEXT;
