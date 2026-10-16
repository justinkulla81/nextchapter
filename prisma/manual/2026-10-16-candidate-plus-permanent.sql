-- Candidate+ stays on once earned (src/lib/scoring/dossier-unlock.ts). Additive.
-- candidatePlusUnlockedAt / candidatePlusUnlockSource ('requirements' | 'streak'): when and how
-- the member first met Candidate+; once set it stays on whatever later weeks look like.
-- candidatePlusRevokedAt: set only by an admin (candidate page); turns Candidate+ off until cleared.
SET lock_timeout = '3s';
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "candidatePlusUnlockedAt" TIMESTAMP(3);
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "candidatePlusUnlockSource" TEXT;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "candidatePlusRevokedAt" TIMESTAMP(3);
