# Market Reality Report

The report at `/dashboard/market-reality`. Rules only, no model call: every sentence is the member's own data or a fixed rule over it, so a sentence cannot disagree with the number beside it.

## Shape
- **Body:** executive summary (overall read, scorecard, priority actions, "Start now"), what changed since last week, sharpen this report, reasons an employer would hire you, how you will be read (recruiter, hiring manager, executive recruiter), likely objections, market, search requirements, direction, start here (twelve weeks).
- **Appendix A–G:** basis, competency profile, experience, skills, resume, search activity, how ratings are set.
- Code: `src/lib/reports/market-reality-brief/` (pure rules plus `load.ts`), `src/components/market-reality/`, `src/app/dashboard/market-reality/page.tsx`. Section order and numbers: `sections.ts`.

## Questions it reads, and where they are asked
Every input is an existing field (see `docs/PERSONALIZATION_SPINE.md`). New in onboarding (Location step): pay floor (`targetCompMin`, same field Search Strategy uses), where searches stall (`searchStallPoint`), offers (`offersReceivedCount`). Applications and interviews were already asked. A few answers can be given in place on the report (`answers.ts`, `answer-actions.ts`); each writes to the existing field.

## Weekly "what changed" note
- The report saves a read each week (`MarketRealityReadState`, one row per member per week) and compares it with the last one (`weekly-change.ts`). It says "nothing moved" when that is true.
- In the report: always on. Email: `/api/cron/weekly-read` (Tuesdays 15:00 UTC), **off unless `WEEKLY_READ_EMAIL_ENABLED=true`**. It emails only members who have opened the report before, are not opted out of weekly emails (`weeklyReportOptedOut`), are not on the MINIMAL tier, and did not already see this week's change in the report, and only when something moved. It builds a full report per member, capped at 60 a run.

## Before deploying
Apply by hand, in order, before the deploy that reads them:
1. `prisma/manual/2026-10-19-search-stall-and-offers.sql` — two columns on `CandidateProfile`. **Not fail-soft:** the generated client selects every column, so deploying first breaks reads of the profile.
2. `prisma/manual/2026-10-19-market-reality-read-state.sql` — one table. Fail-soft: until applied the report works and simply shows no "what changed".

Then, when ready to email: set `WEEKLY_READ_EMAIL_ENABLED=true`.
