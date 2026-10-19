# Unlock points

How a member earns their next search strategy (and a full report refresh). A different, coarser scale from the Weekly Search Score (`src/lib/weekly/action-effort.ts`, 1 point = 1 minute): here a few whole points per activity, answering one question: *has this member done enough new, real work that a fresh read would say something new?*

Code: `src/lib/effort/points.ts` (pure rules, tested in `src/test/effort-points.test.ts`), `src/lib/effort/load.ts` (reads the activity), `src/components/effort/` (card, button, visit ping). Unlock actions: `src/app/dashboard/search-strategy/unlock-actions.ts`, `src/app/dashboard/market-reality/actions.ts`.

## Points

| Activity | Points | Weekly cap | Why |
|---|---|---|---|
| Logged in (a day) | 1 | 5 days | Low signal, almost no effort. Builds the habit; can never unlock on its own. |
| Applied to a job | 2 | 5 | Medium signal for 20 to 40 minutes. A poor fit (per the fit check) earns nothing, as in the probability engine. |
| Networking touch (logged outreach, networking email sent) | 3 | 4 | The highest-signal act in a senior search (weighted 4x an application) and the one members avoid most. |
| Learning completed | 2 | 2 | Real effort, lower signal for a strategy. Completions only. |
| Reference completed | 2 | 3 per cycle | A third party vouching is high signal. Counted when completed, not requested. |
| Partner-search job: showed interest | 4 | 2 | The most valuable single click: a direct role shared with a partner, picked from a short list. |
| Personalization question answered | 1 | 8 per cycle | Cheap, and every answer sharpens every later read. Only questions answered after onboarding, since the cycle began. |

## The bar

| | Active search | Casual / exploring |
|---|---|---|
| Next **strategy** | 30 points | 20 |
| Full **report refresh** | 40 points | 27 |

Plus, for both: at least **2 kinds of real work besides logging in**, and at least **14 days** since the last one, so the new read rests on fresh evidence. Casual = a search intensity other than "actively searching".

Pacing, from the tests: a typical active week (5 logins, 4 applications, 3 networking touches) earns about 22; two such weeks earn 44, so the strategy unlocks at the 14-day floor. A casual member (3 logins, 2 applications, 1 networking touch) earns about 13 a week and unlocks in about two weeks.

## Cycles
Points count from the start of the member's cycle (`EffortCycle`) until they use the unlock. Only that resets it, so editing goals never throws away earned points. The first cycle runs from registration, so real work already done counts. Strategy and report have separate cycles.

## What changed in behavior
Strategy guidance used to re-draft itself every 7 days. It now drafts once automatically (when the goals are in), changes when the member saves new goals, and otherwise only when they unlock the next one.

## Tuning
Every number lives in `points.ts` (`POINT_VALUES`, `CAPS`, `barFor`). Watch `unlock_progress_viewed`, `next_strategy_unlock_clicked` and `next_strategy_generated` in PostHog; if too many members unlock in the first fortnight, raise the bar, and if too few, lower the caps' bite or the casual share.

## Before deploying
Apply `prisma/manual/2026-10-19-effort-points.sql` (an enum and two tables). Fail-soft: until applied, logins earn nothing and the cycle starts at registration.
