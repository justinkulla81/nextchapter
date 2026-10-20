# Market Reality Report

The report at `/dashboard/market-reality`. Rules only, no model call: every sentence is the member's own data or a fixed rule over it, so a sentence cannot disagree with the number beside it.

## Shape
- **Body:** executive summary (overall read, scorecard, priority actions, "Start now"), what changed since last week, sharpen this report, reasons an employer would hire you, how you will be read (recruiter, hiring manager, executive recruiter), likely objections, market, search requirements, direction, start here (twelve weeks).
- **Appendix A–G:** basis, competency profile, experience, skills, resume, search activity, how ratings are set.
- Code: `src/lib/reports/market-reality-brief/` (pure rules plus `load.ts`), `src/components/market-reality/`, `src/app/dashboard/market-reality/page.tsx`. Section order and numbers: `sections.ts`.

## The redesigned report (owner, 2026-10-18: one market report only)
With the redesign on (`isRedesignOn`), `/dashboard/market-reality` is the only market report. Same data, new page (`src/components/market-reality/CurrentReport.tsx`, rules in `src/lib/reports/market-reality-brief/current-report.ts`):
- Always the member's position as of now; the numbers are live. No letter grade, no verdict label, no "Likely to pause". Each line shows the fact it rests on.
- First view: the headline ("N of M things employers hire for are in place"), what is working, the first steps, questions to be ready for. The rest sits behind "Show the rest of the report".
- **Regenerate after your improvements** refreshes the resume rewrites and the weekly plan. It runs only when something new is on file (resume, search details, applications, references since the last report), 30 minutes apart, three a day. Otherwise the page says why and what to do. Event: `market_report_regenerated { reason }`.
- Other entry points are folded in: the menu's Market tab points here, and the grade tile and week-by-week grade archive on Effort and results are replaced by a link. Report rows and snapshots are kept; nothing is deleted.

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
