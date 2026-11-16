-- Member-controlled name sharing with a workforce board (default off) and where the connection came from.
-- Additive. Applied to production 2026-11-16.
ALTER TABLE "WorkforceBoardConnection" ADD COLUMN IF NOT EXISTS "shareIdentity" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkforceBoardConnection" ADD COLUMN IF NOT EXISTS "shareIdentityChangedAt" TIMESTAMP(3);
ALTER TABLE "WorkforceBoardConnection" ADD COLUMN IF NOT EXISTS "source" TEXT;
