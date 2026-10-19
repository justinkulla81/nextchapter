# Strategy credits

How a member earns their next search strategy, which refreshes their Market Reality Report with it. Called **strategy credits** in the UI so it is not confused with the Weekly Search Score (`src/lib/weekly/action-effort.ts`, where 1 point = 1 minute); in code the names stay `points`. A different, coarser scale: here a few whole points per activity, answering one question: *has this member done enough new, real work that a fresh read would say something new?*

Code: `src/lib/effort/points.ts` (pure rules, tested in `src/test/effort-points.test.ts`), `src/lib/effort/load.ts` (reads the activity), `src/components/effort/` (card, button, visit ping). Unlock action: `src/app/dashboard/search-strategy/unlock-actions.ts` (writes the strategy, then refreshes the report best-effort, then starts the next cycle).

## Credits

| Activity | Credits | Weekly cap | Why |
|---|---|---|---|
| Logged in (a day) | 1 | 5 days | Low signal, almost no effort. Builds the habit; can never unlock on its own. |
| Applied to a job | 2 | 5 | Medium signal for 20 to 40 minutes. A poor fit (per the fit check) earns nothing, as in the probability engine. |
| Networking touch (logged outreach, networking email sent) | 3 | 4 | The highest-signal act in a senior search (weighted 4x an application) and the one members avoid most. |
| Learning completed | 2 | 2 | Real effort, lower signal for a strategy. Completions only. |
| Reference completed | 2 | 3 per cycle | A third party vouching is high signal. Counted when completed, not requested. |
| Partner-search job: showed interest | 4 | 2 | The most valuable single click. "Partner jobs" is confirmed to mean a job surfaced from a partner search (`SurfacedJob`) that the member reacted to with Interested (`reactedAt`). |
| Personalization question answered | 1 | 8 per cycle | Cheap, and every answer sharpens every later read. Only questions answered after onboarding, since the cycle began. |

## The bar

One bar: **30 credits**, at least **2 kinds of real work besides logging in**, and at least **14 days** since the last unlock, so the new read rests on fresh evidence. Reaching it unlocks the next strategy and a refresh of the Market Reality Report together. There is no separate report bar and no casual variant.

Pacing, from the tests: a typical active week (5 logins, 4 applications, 3 networking touches) earns about 22; two such weeks earn 44, so the strategy unlocks at the 14-day floor.

## Cycles
Credits count from the start of the member's cycle (`EffortCycle`, one row per member) until they use the unlock. Only that resets it, so editing goals never throws away earned credits. New members' first cycle runs from registration, so real work already done counts. Members registered before 2026-10-19 (`EFFORT_LAUNCH_DATE`) get their first cycle created at their first read after deploy, starting then, with the questions they had already answered not counted. That keeps long-time members from unlocking instantly and triggering many model calls at once. No SQL backfill is needed.

## What changed in behavior
Strategy guidance used to re-draft itself every 7 days. It now drafts once automatically (when the goals are in), changes when the member saves new goals, and otherwise only when they unlock the next one.

## Tuning
Every number lives in `points.ts` (`POINT_VALUES`, `CAPS`, `UNLOCK_BAR`). Watch `unlock_progress_viewed`, `next_strategy_unlock_clicked` and `next_strategy_generated` (with `reportRefreshed`) in PostHog; if too many members unlock in the first fortnight, raise the bar, and if too few, lower the caps' bite.
