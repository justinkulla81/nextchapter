-- When a member was emailed that a search firm they picked has joined. Additive only; safe to re-run.
ALTER TABLE "RecruiterInterest" ADD COLUMN IF NOT EXISTS "joinedNoticeAt" TIMESTAMP(3);
