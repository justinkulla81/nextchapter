-- Résumé prefill markers (src/lib/resume/resume-prefill.ts). Additive.
-- resumePrefilledFields: CandidateProfile field names last filled from the member's
-- résumé and not yet confirmed by them; the profile UI shows "From your résumé — confirm"
-- on these, and a later résumé may only replace a field that is blank or still listed here.
SET lock_timeout = '3s';
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "resumePrefilledFields" TEXT[] NOT NULL DEFAULT '{}';
