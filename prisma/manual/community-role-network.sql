-- Role networks: a community per named leadership role (CRO, CFO, ...), joined by clicking
-- "Join the CRO network" on the role's public page. Additive only.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block; run it on its own.
ALTER TYPE "CommunityType" ADD VALUE IF NOT EXISTS 'ROLE';
ALTER TABLE "CommunityMembership" ADD COLUMN IF NOT EXISTS "lastDigestAt" TIMESTAMP(3);
