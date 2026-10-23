-- Entry-level signals (crawler ncrawl/entry_signals.py; src/lib/jobs/entry-filters.ts).
-- postingSignals (existing text[]) gains the values no_experience_ok, entry_ai and entry_ai_preferred;
-- the phrase that set no_experience_ok is kept here. Additive only.
SET lock_timeout = '5s';
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "noExperiencePhrase" text;
