# Project instructions

## Design principles

Whenever you design a new product, feature, UI, or write code that produces
user-facing output, you MUST consult the design principles below and apply
every relevant rule. If a design would violate a principle, revise it or
explicitly flag the conflict and explain the tradeoff before proceeding.

@design-principles.md

## Analytics instrumentation

PostHog is wired up (`src/lib/posthog/`) — SDK init, pageview tracking, and
user identification on dashboard load. Whenever you build a new feature that
involves a user action (a button click, a form submit, an unlock, a
generated artifact, a status change), fire a PostHog event for it as part of
that same build — do not ship the feature first and add analytics later.
Name events `snake_case`, past-tense-ish and specific (`job_rated`, not
`click`), and include the IDs/params a real query would need (e.g.
`{ jobId, source, reaction }`, not just the event name). Use
`posthog.capture()` client-side for user-initiated actions; use
`posthog-node` server-side for events that only happen in a Server Action
(add the package when the first such event is needed).

## Links in replies

Whenever you mention a page, route or path of this app to the user, give the
full URL (`https://launchyournextchapter.com/...`), never a bare path like
`/support/admin/organizations`. This is a strict rule from the owner.

## Adding or removing a top-level route

`src/lib/app-top-level.ts` (`APP_TOP_LEVEL`, `PORTAL_ROOT_PAGES`) must list every
top-level folder under `src/app`. `src/test/app-top-level.test.ts` fails CI on
`main` if they drift (it did on 2026-10-19). When you add or remove a route
folder, update that file in the same change and run `npx vitest run
src/test/app-top-level.test.ts` before pushing.

## Candidate site redesign

Every page under `src/app/dashboard` follows `docs/candidate-redesign.md`: the
owner's brief, the decisions already made, and the page contract (one headline,
one primary action, three sections at most on the first view, every claim says
why). A change that adds a card, tag, toggle or section to a candidate page must
say what it removes. Build or change a page in `src/app/dev-preview/` first and
look at a screenshot before wiring real data.

## Vercel and Supabase: Claude does the operations work

The owner does not want to set Vercel environment variables or run Supabase
SQL by hand. Do it yourself, and say what you ran when you report back.

- **Vercel**: use the API with `VERCEL_TOKEN`, `VERCEL_ORG_ID` and
  `VERCEL_PROJECT_ID` (set in the cloud environment's settings). Set or change
  environment variables there and redeploy production when a change needs it.
  If those variables are missing, say so plainly instead of handing the owner
  steps. Never print the token, write it to a file or commit it, and never ask
  for it to be pasted into chat.
- **Supabase**: use the Supabase connector. Apply additive changes (new tables
  or columns, backfills) to production yourself, in the order the code needs,
  and keep the matching SQL file in `prisma/manual/` (never `prisma db push`).
  Apply a SQL file before the deploy that reads it if the code is not fail-soft.
- **Ask first** before anything destructive or hard to undo: dropping or
  renaming columns or tables, deleting or rewriting existing rows, removing an
  environment variable, or changing a variable that is already set.

## Working style

Do not add, offer or promise things the company is not required to provide in
order to be a "good guy" (for example public commitments about how we hire,
pay, screen or treat applicants, optional disclaimers, or extra statements).
They can create unintended consequences. Include only what is required or what
was explicitly asked for, and don't end replies with offers of further extras.

## Jobs report scope

Every jobs report, local (a metro or county) and national, covers **all white-collar
jobs at every level**, entry-level included, not only mid-level and above.
White-collar means Census major occupation groups 1 and 2 (management, business and
financial; professional and related), the same definition the White Collar
Employment Report uses. Do not filter entry-level postings out of the data, the
pipeline, or the report. The all-jobs frame (every occupation) is secondary and
must be labeled as such; never blend frames into one number. If the data does not
yet include entry-level white-collar postings, say so in the report and fix the
data, rather than reporting a mid-level-and-above view as the whole. Spec:
`docs/specs/NextChapter_Jobs_Report_Spec.md`.

## Employer discovery rule

When finding an employer's jobs, look at its **career site and job system**, never its corporate website. Corporate
sites often block automated requests; career sites and the job systems behind them (Workday, Greenhouse, Lever, Ashby,
SmartRecruiters, Jibe/iCIMS, Oracle, Taleo, UKG, NEOGOV, Phenom, Tyler, and the like) are public by design, because
employers want their openings found. A 403 on `www.<employer>` says nothing about the jobs. Try `careers.`, `jobs.`,
`employment.` hosts and the job-system links on them (`scripts/jobsreport/career_site.py`), and follow the "Apply"
links on the corporate careers page. Only call an employer unreadable after the career site and its job system were tried.
