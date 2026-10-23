-- Usage-triggered coaching upgrade offer. Additive only: one enum value, one column.
-- Apply by hand before the deploy; never plain `prisma db push` on prod.
ALTER TYPE "CandidateEmailKey" ADD VALUE IF NOT EXISTS 'UPGRADE_OFFER';
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "upgradeOfferOptedOut" BOOLEAN NOT NULL DEFAULT false;
