# Smoke test for the career, resume, documents and booking release

Nothing in this release has run against a real database. Run this once after the SQL and data are loaded, with a real candidate account, a coach account that has that candidate as a client, and an outplacement org admin. Each step says what you should see and what a failure probably means.

## Already tested on a scratch Postgres 16 (not your database)

The seven SQL files ran cleanly twice in a row (so re-running is safe) and created 18 tables with row-level security on. The O*NET, BLS and training-list importers loaded fixture files and applied the white-collar scope, wage-ceiling flags and removal of withdrawn programs. The app's own code then read that data: a Cambridge, MA address resolved to the Boston metro and a pay comparison used metro figures on both sides. A booking race between two people gave one winner, a failed calendar call did not break the booking, and cancelling twice was handled. This also found and fixed a real bug (the booking lock call would have failed on first use). What this did not cover: real O*NET and BLS file sizes and layouts, the browser screens, Google Calendar, email, storage uploads and the AI calls.

## Before you start
1. SQL applied (see `docs/RELEASE_2026-10-14.md`, plus `2026-10-15-career-local.sql`). Check that the tables exist, for example `Occupation`, `OccupationWage`, `ResumeDraft`, `DocumentRequest`, `CoachBooking`, `CoachNoteSummary`.
2. Private storage bucket `requested-documents` exists.
3. Data loaded. `careers:import-onet --dry-run` first: the occupation count should be a few hundred, not about 900. If it is 900, the scope filter is not applied; if it is under about 100, check the Job Zones file name.
4. `careers:import-bls --dry-run` for the national, state and metro files: each prints rows read, rows kept and areas. If "rows read" is 0, the column names did not match; the warning says so.

## Candidate
- **Pivot paths** (`/dashboard/pivot-paths`; the old `/dashboard/pivot` redirects here): the market-ranked list shows as before. With O*NET and BLS data loaded, each path has a "What it takes" section: pay for your metro or state with "Middle half earn", growth, day-to-day tasks, tools and knowledge you may not show yet, training, "Add these skills to my plan" and "Make this my target role" (which asks first if you already have one). Below the list, "More roles that use similar skills" shows up to 12 roles with a band (not a percentage), and the three pay buttons should change the list with the busy cursor showing. Pick a role whose pay is above the BLS ceiling: it should read "$239,200 or more" with the explanation, never a number below it. "Look up any role" searches job titles and opens one role's card. If your title doesn't match one occupation, a "Choose my occupation" prompt appears instead. "Choose an occupation" and set a target role, then use **Clear my saved occupation and target role**: it asks first with "Keep them" focused, and after "Clear them" the target role is empty on Search Strategy. The occupation is matched from your resume title again but not saved. With no data loaded, only the market-ranked list shows, with no error.
  - Switch the pay filter between the three buttons: the list should change and the busy cursor should show.
  - Pick a role whose pay is above the BLS ceiling: it should read "$239,200 or more" with the explanation, never a number below it.
  - "Make this my target role" asks first if you already have one.
- **Find my job**: cards show a "Skills fit" line; a title that can't be placed says so. The O*NET credit line appears under the list.
- **Skills**: suggestions for your target role mention O*NET and show the credit line.
- **Resume studio** (`/dashboard/resume/studio`): start from your profile; every role has at least its one bullet; edit, save, reload, change template, download PDF and Word and open both. Paste a job description and run the keyword check. Make a save fail (clear your name) and confirm nothing else you typed is lost.
- **Documents** (`/dashboard/documents`) and nav badge: after the coach requests one, the badge shows 1; upload a PDF; try an `.exe` renamed `.pdf` (should be refused).
- **Book a coach session** (`/dashboard/book-session`): with the coach's booking on, pick a day and a time; times should be in your own time zone and match the coach's hours; book; a second browser trying the same slot should be told it was just taken. Cancel.

## Coach
- **Booking** (`/support/coach/booking`): set hours in a different time zone from yours, save, confirm a client sees the right converted times. Enter an end time before a start time: the error appears and nothing you entered is cleared.
- **Client page**: Documents card (request one with a due date, then accept and send back with a note); Summarize my notes (needs at least one session with notes).
- Calendar: if the Google Calendar connection exists, the session shows a Meet link and both people get an invitation; if not, the booking still works and an email goes out.

## Employer admin
- `/employer/program`: set a logo and color; an enrolled person's dashboard shows the bar across the top, labelled "with NextChapter".

## Things to look at in the logs afterwards
- `Career taxonomy unavailable`, `Local pay areas unavailable`, `Skill aliases unavailable`: expected before data is loaded, a problem after.
- `Booking ... calendar event`: a calendar call that failed.
- PostHog events: `pivot_tool_viewed`, `pivot_path_viewed`, `skill_gap_viewed`, `resume_draft_saved`, `document_requested`, `coach_session_booked`, `coach_note_summary_generated`.
