# Deploy checklist: Market Reality Report, weekly read, search effort

Order matters. Do these before the deploy goes live.

1. Merge PR #83.
2. Apply the three SQL files in `prisma/manual/`, all dated 2026-10-19, in this order:
   1. `2026-10-19-search-stall-and-offers.sql` adds `searchStallPoint` and `offersReceivedCount` to `CandidateProfile`. **Not fail-soft**: deploying first breaks profile reads. Apply it first.
   2. `2026-10-19-market-reality-read-state.sql` (weekly "what changed" store). Fail-soft.
   3. `2026-10-19-effort-points.sql` (the strategy-unlock cycle; the visit-days table in it is no longer used). Fail-soft.
3. Deploy.
4. `WEEKLY_READ_EMAIL_ENABLED` stays **unset (off)**. The in-report "What changed" card works without it. Turn it on (`true`) after at least one full week of saved read states exist, so the first email has something to compare; the Tuesday 15:00 UTC cron `/api/cron/weekly-read` then sends in batches of 60.
5. Smoke test: open `https://launchyournextchapter.com/dashboard/market-reality` and `https://launchyournextchapter.com/dashboard/search-strategy` (the unlock block shows when the member has answered once).

Decisions taken (change in code if you disagree): long-time members' first unlock cycle starts at their first read after deploy; the unlock uses the same minutes of search effort as the weekly score and Candidate+ (180 minutes, 14 days), and covers strategy and report refresh together.
