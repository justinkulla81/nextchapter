# Parallel paths

Defined 2026-10-23. Code: `src/lib/journey/paths.ts` (pure), page `src/app/dashboard/other-paths/`, view
`src/components/dashboard/paths/OtherPathsView.tsx`, mockups `/dev-preview/learn/other-paths/*`.
Tests: `src/test/parallel-paths.test.ts`.

## The model

A member has **one main focus** (`profile.journey`, 12 journeys) and any number of **paths next to it**.

- The main journey alone sets the weekly plan's base, the menu mode and which emails go out
  (`notLookingNow`, `NOT_CASUAL_WHERE`, `menuMode`). Nothing about a parallel path changes those.
- Each parallel path adds **at most one plan step** (`parallelPlanItems`) and **one card** on the page.
- Full-time fractional work stays a journey (`FRACTIONAL`). Fractional work as a side line is one of the kinds of side work.
- "Thinking about a new job" is a main journey (`EXPLORING_MOVE`), not a path. A member whose main focus is buying who
  says "I'm ready to start applying" becomes `EXPLORING_MOVE` with buying kept as a path (nothing is lost, see below).

## Where the data lives (no schema change)

| What | Where |
| --- | --- |
| Buying a business: answers and stage | `journeyDetails.buy` (unchanged) |
| Side work: hours a week, monthly income, goal | `journeyDetails.alongside.side` |
| Kinds of side work (1099, fractional or interim, consulting, own business, part-time, training) | the existing `ParallelPath` table, first asked on Past jobs and read by the job board and the coach brief. One answer, one place. |
| How soon income is needed | `journeyDetails.incomeNeed` (`now`, `soon`, `covered`) |
| The journey they came from | `journeyDetails.alongside.previousMain`, set by `applyJourneyChange` on every journey change |

## What we ask, and what was already asked

Already asked and not repeated: what they do alongside the search (Past jobs, `ParallelPath`); "working now"
(`workingNow`); monthly need and severance and coverage dates for the laid off (`situation.ts`); financial pressures and
"money help" (Finances and benefits); the runway calculator (savings and expenses, never stored).

New, because nothing asked it: **How soon do you need income?** (within two months, three to six months, covered for six
months or more). It is a situation question for every journey except full-time fractional, so it also appears in Account and
privacy. And for side work: hours a week, about what it earns a month, and what it is for (cover bills, extra money, grow it
into main work, test an idea).

## When interim or fractional work is recommended

Only when income is needed within six months (`now` strongest, `soon` lighter) **and** the member is not already earning that
way (any of 1099, fractional or interim, consulting, part-time, or "working now") **and** their main journey is not full-time
fractional. It shows as one plan step and one card with the reason. Early-career members never see it (the plan drops any step
that says fractional or interim for them). Nothing is recommended to someone who is covered or has not answered.

## Money

- Side income is added to "Monthly money coming in" on the runway calculator, and the result says how many months it adds.
  The calculator's own numbers still are not stored; only the side income the member typed on the paths page is.
- For a laid-off member who gave a monthly need, the plan says how much of it side income covers and the gap.
- The Buy plan's "keep income coming" links go to the member's own side-work card when they have one, otherwise to interim work.

## Switching

"Change your main focus" (behind Show more) can make buying or full-time fractional work the main focus, and go back to the
previous one. Everything told about the other paths is kept. Settings in Account and privacy do the same.

## What it adds and removes

Adds one Learn entry, "Your other paths" (the Buy a business entry now sits inside it as a second switch, so Learn has no more
entries than before), one page, one question, and one plan step per active path. Adds nothing to Home: the steps appear in
the weekly plan Home already shows. Removes nothing.

## Analytics (PostHog)

`other_paths_viewed`, `income_need_saved`, `income_recommendation_clicked`, `side_work_saved`, `parallel_path_opened`,
`parallel_path_switched_main` (from, to, direction), plus the button events (`*_pressed`).

## Cost

Static. No model calls and nothing metered.

## Not built

Side hustle as a main journey (rejected: it would take away a member's career plan); a path for school or training (the
`TRAINING` kind is recorded only); exact income amounts for the runway beyond the side-work figure.
