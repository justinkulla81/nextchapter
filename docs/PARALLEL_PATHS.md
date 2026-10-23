# Parallel paths

Defined 2026-10-23. Code: `src/lib/journey/paths.ts` (pure), page `src/app/dashboard/other-paths/`, view
`src/components/dashboard/paths/OtherPathsView.tsx`, mockups `/dev-preview/learn/other-paths/*`.
Tests: `src/test/parallel-paths.test.ts`.

## The model

A member has **one main focus** (`profile.journey`, 12 journeys) and any number of **paths next to it**.

- The main journey alone sets the weekly plan's base, the menu mode and which emails go out
  (`notLookingNow`, `NOT_CASUAL_WHERE`, `menuMode`). Nothing about a parallel path changes those.
- A path is **active only at researching or doing it**. Curious costs the plan and the page nothing.
- Each active path adds **at most one plan step** (`parallelPlanItems`) and **one card**. Home says at most one thing, as it
  always has; paths add no Home note.
- Full-time fractional work stays a journey (`FRACTIONAL`). Fractional work as a side line is a path.
- A new job is a main journey (`EXPLORING_MOVE`); it shows as a path only when the main journey is not a search.

## What else are you thinking about?

Asked once, in one short step on Your other paths: a new job, buying a business, starting a business, fractional or
consulting work, side income or part-time, going back to school. Per item: curious, researching, doing it, or not thinking
about it. **We do not re-ask what we know**, so these are derived and shown as known:

| Path | Derived from |
| --- | --- |
| A new job | main journey is a search |
| Buying a business | main journey is Buy a business, or a started buying plan (decide or prepare = researching; search or later = doing) |
| Starting a business | main journey is Building something of my own, or "own business" in the side-work answer |
| Fractional or consulting | main journey is fractional, or fractional or consulting in the side-work answer; `interimConsultingInterest` = researching |
| Side income or part-time | part-time or 1099 in the side-work answer, `workingNow`, or side-work details |
| Going back to school | "school or training" in the side-work answer |

The member's own answer always beats a derived one. It is stored as `journeyDetails.paths.<key>.level`, beside that path's own
answers. It is private; the coach sees "thinking about" with levels only where the member shared their search with that coach
(the same check as the rest of the pre-session brief, `getCoachClient`). PostHog: `paths_interest_saved` with the levels.

## How long could you go without new income?

One question for every journey except full-time fractional, with four answers: a year or more, 6 to 12 months, 3 to 6 months,
under 3 months. **Derived, not asked,** when `journeyDetails.cushionMonths` (saved on Career story) or an entrepreneur's
`runwayMonths` exists. (The laid-off `monthlyNeed` is dollars a month, not months of cushion, so it cannot be turned into an
answer without savings, which we do not store.) The member can still override it.

| Answer | What the plan does |
| --- | --- |
| Under 3 months | Income first, in order: unemployment and benefits (laid off only), then contract, temp or part-time, then interim or fractional (a first client takes weeks) |
| 3 to 6 months | One income step a week, alternating the quicker kind with interim or fractional (non-senior members always get the quicker kind) |
| 6 months or more | No step. Interim and fractional work shows as an option on Your other paths |

Not shown to full-time fractional members or anyone already earning on the side (any side-work kind, or "working now").
Early-career members never see interim or fractional steps (the plan drops any step that says so) and get part-time and contract
steps. The Buy plan's income note now comes from this answer instead of a general line.

## Where the data lives (no schema change)

| What | Where |
| --- | --- |
| Level of each path | `journeyDetails.paths.<job, buy, start, fractional, side, school>.level` |
| Side work: hours a week, monthly income, goal | `journeyDetails.paths.side` |
| Kinds of side work | the existing `ParallelPath` table (Past jobs; read by the job board and coach brief) |
| Buying a business: answers and stage | `journeyDetails.buy` (unchanged) |
| How long they could go without income | `journeyDetails.incomeNeed`, or derived |
| The journey they came from | `journeyDetails.paths.previousMain`, set by `applyJourneyChange` |

## Already asked, not repeated

What they do alongside the search (Past jobs, `ParallelPath`); `workingNow`; `interimConsultingInterest`; monthly need and
severance and coverage dates for the laid off; financial pressures and money help; the runway calculator (never stored).

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
entries than before), one page, two questions, and one plan step per active path. Adds nothing to Home: the steps appear in
the weekly plan Home already shows. Removes nothing.

## For partnership conversations

`pathInterestCounts` (`src/lib/journey/path-interest-counts.ts`) and `getPathInterestCounts` (`src/lib/admin/path-interest.ts`) return
counts per path and level only, from members' own stated levels, real members only, nobody in Confidential Search Mode, and any
cell under 10 members withheld. No rows, names or ids. Nothing goes to any outside party. There is no screen for it yet.

## Analytics (PostHog)

`paths_interest_saved` (levels, stated, activeCount), `other_paths_viewed`, `income_need_saved`, `income_recommendation_clicked`, `side_work_saved`, `parallel_path_opened`,
`parallel_path_switched_main` (from, to, direction), plus the button events (`*_pressed`).

## Cost

Static. No model calls and nothing metered.

## Not built

Side hustle as a main journey (rejected: it would take away a member's career plan); a path for school or training (the
`TRAINING` kind is recorded only); exact income amounts for the runway beyond the side-work figure.
