# Monthly member report

An internal report on NextChapter members, built automatically on the last day of every month, stored, and emailed.

## When it runs
`/api/cron/monthly-user-report` fires at 23:00 UTC on the 28th–31st (`vercel.json`). The handler does the work only when tomorrow is the 1st (UTC), so exactly one run a month builds the report; the others answer "skipped". The month is the calendar month in UTC.

## Where to read it
- Admin → Reports → **Monthly member report** (`/support/admin/monthly-report`). Month picker, CSV export, and a "Build report now" button (rebuilds a month in place; does not send the email).
- Email summary (headline numbers, what stood out, link) to `MONTHLY_REPORT_TO`, default `justin@launchyournextchapter.com`.

## What it covers
Overview and trend · who members are (seniority, education, universities, fields of study, age band) · geography, industry, function · companies (current, former, applied to) · progress (milestones, Market Reality grade and movement) · goals and signals (intensity, readiness, comp, flexibility, motivations, blockers, barriers) · effort and strategy (activity, channel mix and which channels reached interviews, outreach, mood) · networking · coaching and style · recruiters and outcomes · correlations (group comparisons and rank correlations).

## Privacy
- Aggregates only. No member ids, names or free text are stored in the report.
- Groups under 5 members are dropped **before** the report is saved (`MIN_CELL_SIZE`), so the page, CSV and email cannot show them. Rank correlations need at least 30 members.
- Excludes the system account, sample data and deactivated accounts.
- Comparisons show association, not cause.

## Setup before the first run
Apply `prisma/manual/2026-10-14-monthly-user-report.sql` by hand (one additive table, `MonthlyUserReport`). Until then the page shows an empty state and the cron records a failure in the cron ledger.

## Code
`src/lib/reports/monthly-user/`: `load.ts` (database → per-member facts), `build.ts` (facts → report, pure), `store.ts` (generate, upsert, trend), `notify.ts` (email), `csv.ts`. Tests: `src/test/monthly-user-report.test.ts`.

## Analytics events
`monthly_user_report_generated` (cron), `admin_monthly_report_generated` (manual), `admin_monthly_report_exported`, `monthly_report_viewed` (client).
