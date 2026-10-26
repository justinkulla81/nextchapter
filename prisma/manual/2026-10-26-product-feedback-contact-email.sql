-- Lets the "your idea shipped" email reach partner-portal senders (employer,
-- recruiter, coach, institution), who have no candidate profile. One nullable
-- column, nothing else. Safe to run more than once. Apply BEFORE the deploy
-- that reads it.
ALTER TABLE "ProductFeedback" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
