-- Self-reported search snapshot additions: where searches usually stall, and offers received.
-- Additive, nullable, re-runnable. RUN BEFORE the deploy that reads them.
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "searchStallPoint" TEXT;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "offersReceivedCount" INTEGER;
