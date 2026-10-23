-- Entry-level "Training provided" (crawler ncrawl/entry_signals.py detect_training; src/lib/jobs/entry-filters.ts).
-- postingSignals (existing text[]) gains the value training_provided; the phrase that set it is kept in its own
-- column, next to noExperiencePhrase (a job can carry both flags, each quoting its own words). Additive only.
SET lock_timeout = '5s';
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "trainingPhrase" text;
