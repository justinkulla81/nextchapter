# Monthly discovery run (how new conferences get found)

A scheduled Claude task runs this once a month. Existing events stay current on their own (the daily refresh cron in
`src/lib/events/run-refresh.ts`: link check, finished editions rolled forward, announced dates picked up). This run finds
events we do not hold yet.

1. Make a worktree from `origin/main` on a branch named `events-discovery-YYYY-MM`. `npx prisma generate` if needed.
2. `npx tsx scripts/events/discovery-batch.ts` prints this month's segments (about 19), each with its jobs and how many
   published events we have. Rotating, so every segment is searched once a year.
3. Split the segments across at most 3 Sonnet subagents at a time (more hit the fetch rate limit). Each reads
   `data/events/README.md`, `README-v2.md` (schema, verification standard, extra fields) and `README-v3.md` (gap-fill rules), skims
   `data/events/_existing.txt` and the existing `v2/`, `v3/`, `v5/` file names for what we already hold, and writes
   `data/events/v5/YYYY-MM-<n>.json`: credible conferences, trade shows and annual meetings for those segments' jobs that are
   NOT in the catalog, at least 3 per segment where they exist. Member-only events are published as INVITE or APPLY with how to
   join; events outside North America only if they are the field's global flagship; nothing supported only by third-party listings.
4. `npx tsx scripts/events/build-catalog.ts`, then `npx vitest run src/test/events.test.ts src/test/events-headsup.test.ts src/test/events-refresh.test.ts`.
5. Commit only `data/events/**` and `src/lib/events/catalog.json`, push, open a PR titled "Events: monthly discovery YYYY-MM" with the counts
   (new events, published, segments searched). Do not merge: the owner merges (or tells Claude to). Never touch the database.
6. The daily refresh cron loads the new catalog into the database (locked rows are never overwritten). Report the counts back.

Cost: runs on the owner's Claude plan, no API billing. About 3 to 4 subagent runs a month.
