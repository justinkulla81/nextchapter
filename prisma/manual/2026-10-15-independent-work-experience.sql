-- CandidateProfile.independentWorkExperience. Additive only (one nullable
-- column). Apply by hand; never plain `prisma db push` on prod.
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "independentWorkExperience" JSONB;
