# Unlocking the next strategy

One measure of activity runs through the product: **minutes of real search effort, where 1 point is 1 minute** (`src/lib/weekly/action-effort.ts`, summed by `src/lib/scoring/effort-minutes.ts`). The same minutes grade the week (Weekly Search Score) and earn Candidate+. The next search strategy uses them too, so a member learns one number.

## The bar

**180 minutes** of search effort since their last strategy, and at least **14 days** since it, so the new read rests on fresh evidence. Reaching it unlocks the next strategy and refreshes the Market Reality Report together. 180 is a starting guess (Candidate+ asks for 480 in total); tune `UNLOCK_BAR` in `src/lib/effort/unlock.ts`.

The Search strategy page shows it as the one navy block with a lock (open when earned): the minutes so far, what is still missing, a link to this week's plan, and one button when earned.

## How minutes are counted
Effort since the cycle began is the sum of earned points on the member's weekly plans (`WeeklySprint`) from the week that contains the cycle start. Because plans are weekly, the start week counts in full.

## Cycles
`EffortCycle` holds one row per member with `startedAt`. Only unlocking a new strategy resets it, so editing goals never throws away earned effort. New members' first cycle runs from registration. Members registered before 2026-10-19 (`EFFORT_LAUNCH_DATE`) get their first cycle created at their first read after deploy, starting then, so long-time members do not unlock instantly and trigger many model calls at once.

## Code
`src/lib/effort/unlock.ts` (pure rules, tested in `src/test/effort-unlock.test.ts`), `src/lib/effort/load.ts` (reads the minutes and the cycle), `src/components/effort/UnlockProgress.tsx`, action `src/app/dashboard/search-strategy/unlock-actions.ts` (writes the strategy, refreshes the report best-effort, starts the next cycle). Events: `unlock_progress_viewed`, `next_strategy_unlock_clicked`, `next_strategy_generated` (with `reportRefreshed`).

## History
An earlier version used a separate points table (logins, applications, networking and so on, 30 "strategy credits"). It was removed to keep one measure. Two tables from it remain in the database, unused and harmless: `CandidateVisitDay` (never written now) and the `baselineAnswered` column on `EffortCycle`. Dropping them needs the owner's approval.
