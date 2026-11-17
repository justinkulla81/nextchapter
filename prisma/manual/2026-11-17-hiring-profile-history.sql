-- Employer page hiring history, precomputed by the nightly company-hiring-index build (rebuildHiringProfiles) instead of read from
-- every opening the employer ever had on each page render (historyFor in src/lib/seo/employer-insights.ts: 27,103 calls in a day and
-- a half, up to 14.8 s each, 2026-11-17). Shape: { months: [{ month: 'YYYY-MM', opened }], closed, firstSeen, last90, prior90 }.
-- Additive; the page falls back to the live query while it is NULL.
ALTER TABLE "CompanyHiringProfile" ADD COLUMN IF NOT EXISTS "history" jsonb;
