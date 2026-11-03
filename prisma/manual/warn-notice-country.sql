-- Country a reported layoff is in (ISO 3166-1 alpha-2), so the public layoff tracker can filter by country. A state filing
-- needs none (its state says US). country stays null when the story does not say or spans several countries; countryCheckedAt
-- is set once a notice has been looked up, found or not, so it is asked once. Additive; safe to re-run.
ALTER TABLE "WarnNotice" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "WarnNotice" ADD COLUMN IF NOT EXISTS "countryCheckedAt" TIMESTAMP(3);
