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
