-- Direct employer listings (owner's call 2026-10-19): a job taken straight from the
-- employer's own careers site / ATS (ncrawl config.is_direct, sent by import-jobs.py as
-- directListing) is exempt from the 30 / 60-day posted-date windows while the employer
-- still lists it; only a 365-day backstop applies. Additive; constant default, so no
-- table rewrite. Run with: SET lock_timeout = '5s';
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "directListing" BOOLEAN NOT NULL DEFAULT false;
