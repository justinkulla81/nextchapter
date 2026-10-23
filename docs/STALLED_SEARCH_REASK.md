# The stalled-search re-ask

Defined 2026-10-23. Code: `src/lib/journey/stalled-reask.ts` (pure), `src/lib/dashboard/stalled-reask.ts` (read-only
check), `src/app/dashboard/reask-actions.ts`, `src/components/dashboard/StalledReaskCard.tsx`. Tests: `src/test/stalled-reask.test.ts`.

## What it is

After a stretch of searching with no interviews, Home asks once: **what do you want to change?** Four answers: broaden my
targets, pivot to another field, add something next to my search, or talk to a coach. Each shows one reason and goes to one place.
It is the Home note for those members (Home has one note: it wins over the narrower stalled-search card, and setup and reports
still come first).

## What already existed, and how this differs

| Already there | What it does |
| --- | --- |
| Weekly gates (`gateMoveFor`, weeks 3, 6, 9, 13) | Adds plan steps over time: résumé fixer, widen targets, interim or fractional, a coach, a different lane. Never asks. |
| Stalled-search card (`stalled-search-prompt.ts`) | Speaks to members who hit their application and outreach goals for two or more weeks with no interviews. Suggests a fit check, interim work, a coach. |

The re-ask is the one place that asks the whole question, for any searching member with nothing to show for it, and it asks only what
is new to them.

## When it fires

- The main journey is a search, the stage is applying, and there are no interviews (job postings or calendar) and no offers since
  they entered the stage.
- Six weeks into the stage. A casual search counts at half pace, like the gates (twelve weeks).
- First ask when due. Not again for 42 days after they were asked or answered. "Not now" waits 28 days. "Don't ask again" stops it.
  Three asks at most.
- It is recorded as asked only once the card paints, never during the server render, like the other Home prompts.

## Without re-asking what we know

- Told us the fields they are open to (`journeyDetails.pivot`): the pivot option points at those instead of asking.
- Has a coach: "Book time with my coach", not "Talk to a coach".
- Has active paths: "Change what I do next to my search", not "Add something".
- Chose an option in the last six weeks: it is not offered again (never fewer than two options shown).
- Short on income (the answer from Your other paths is under 3 or 3 to 6 months) and not earning: paths goes first, with that reason.
- Interim and fractional work are named only to senior members. Early-career members see "side work, school, or buying a business".

## What happens next

The answer is stored in `journeyDetails.reask` (no schema change) and sends the member to the right page. For four weeks the weekly
plan carries one matching step: widen targets, one conversation in a field they would test, a step on the path they chose, or book
a coaching session. No step names fractional or interim work.

## Analytics (PostHog)

`stalled_reask_shown` (weeks, asks), `stalled_reask_option_pressed`, `stalled_reask_answered` (answer, weeks, asks, hasCoach),
`stalled_reask_snoozed`, `stalled_reask_stopped`.

## Cost

Static. No model calls and nothing metered. One small read for members outside an active search; the full signals only for those in it.

## Not built

Asking members who are casually looking or in other stages; a coach-side view of the answer.
