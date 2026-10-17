-- Strict relevance, confirmed industries and admin ghost review (2026-10-16).
--
-- CandidateProfile.industryBuckets: the industries the member confirmed on Search Strategy
--   (industry-buckets.ts names) when their free-text industry read as several or none
--   (src/lib/profile/industry-reading.ts); industryBucketsConfirmedAt: when.
-- JobPostingFlag.adminDecision: an admin's call on member ghost / too-good flags —
--   'confirmed_ghost' hides the job for everyone, 'dismissed' keeps it; decidedAt: when.
--
-- Additive only. Apply with a short lock_timeout before deploying the code.

SET lock_timeout = '5s';

ALTER TABLE "CandidateProfile"
  ADD COLUMN IF NOT EXISTS "industryBuckets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "industryBucketsConfirmedAt" TIMESTAMP(3);

ALTER TABLE "JobPostingFlag"
  ADD COLUMN IF NOT EXISTS "adminDecision" TEXT,
  ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);
