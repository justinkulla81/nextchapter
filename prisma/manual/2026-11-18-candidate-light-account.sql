-- Light accounts (owner decision 2026-11-18): an account opened from a follow-up email before onboarding.
-- Additive and nullable; read by src/app/onboarding/account-ready and src/app/onboarding/your-jobs.
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "lightAccountAt" TIMESTAMP(3);
