# Your career story

`/dashboard/my-career` (tab "Career timeline" under Personalize) and a compact copy in the Market Reality report.
A private, visual timeline of school, work, ventures, pauses and learning, with "doors you could open" and a pause what-if.

## Where the data comes from
- Derived, nothing entered twice: work history, education, learning badges, plus quiet stretches of 90+ days ("A pause", "Between roles").
- Member-added or corrected: `CareerEvent` table (`prisma/manual/2026-10-17-career-events.sql`, **apply before launch**; until then the page shows only derived events). A correction to a derived event is a row with `sourceRef` (`work:<id>`, `edu:<id>`, `gap:<date>`); hiding sets `hidden`. Source data is never changed.
- Preferences in `journeyDetails`: `cushionMonths` (months of expenses saved) and `storyHideYears`.

## Rules
- Doors, never walls: ranges not dates, "a bigger door" not a warning, no age framing, "Hide years" switch.
- `CareerEvent` is read only by `src/lib/career-story/load.ts` and `src/app/dashboard/my-career/actions.ts` (enforced by a test). Employers, colleges, coaches and recruiters never see it.
- "People like you": same function, real members only, not in confidential mode; groups under 10 are hidden, counts under 50 round to 5; an honest empty state otherwise.
- Phone and screen readers get the same story as a list.

## Events (PostHog)
`career_story_viewed`, `_event_added`, `_event_updated`, `_event_corrected`, `_event_removed`, `_cushion_saved`, `_years_toggled`, `_pause_tried`, `_list_view`.

## Code
`src/lib/career-story/{events,layout,summary,pause,doors,peers,validate,load}.ts`, `src/components/dashboard/career-story/*`, tests in `src/test/career-story*.test.ts`.

## Stepping back from full-time work
Four paths, asked with the other situation questions for Next act and Managing my career (`src/lib/journey/retirement.ts`, fields `retirementPath`, `retirementBy`, `retirementIncome` in `journeyDetails`): an encore, cut back gradually, stop working, not sure yet. Each gives plan steps, and a "step back" door beside growing where you are. No age is asked or used. It is an overlay on existing journeys, not a new journey type, so no database enum change was needed.

## When an employer seat ends
`src/lib/employer/seat-continuity.ts`, `SeatEndingBanner` on the dashboard home (last 30 days), and the access-ending email (career growth wording for growth seats). What stays: account, profile, career story, plan, pay research, learning paths. What ends: coaching sessions and the recruiter network the employer provided. A seat never changes the journey back.
