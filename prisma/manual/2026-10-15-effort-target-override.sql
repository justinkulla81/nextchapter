-- Per-member override of the Candidate+ search-effort target (minutes).
-- Additive only: one nullable column, metadata-only on Postgres. Apply by hand;
-- never plain `prisma db push` on prod.
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "effortMinutesTargetOverride" INTEGER;
