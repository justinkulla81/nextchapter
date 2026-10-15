# Onboarding v2

Status: draft spec. No code written. Written against `origin/main` plus two unmerged branches
(see "Alignment"). Re-read those branches before building: they are moving.

## Goal

A new member signs in with Google, sees their search read back to them in a minute, and wants
to give us more because each answer visibly makes the product better. Everything they give us
maps to something they can see. The work they do (not the questions they answer) is what
earns trust with employers.

## Principles

1. Ask only what something reads. Every question names what it drives (see the spine, below).
2. Every answer shows a result on the same screen.
3. Everything is skippable. Soft gates only; no screen blocks the dashboard.
4. One primary action per screen. 2-4 options are buttons, 5+ are a list.
5. Setup is not effort. Only job-getting work counts toward what employers see.
6. Free, but not no-work: say it at sign-up and again at the first sprint.

## Alignment with parallel work

Two unmerged branches overlap this spec. This spec builds on them and does not redo them.

| Area | Where it lives | What onboarding v2 does |
|---|---|---|
| Six-place nav, including **Personalize** (My story, My profile, My work profile, My search, For recruiters) | `claude/candidate-dashboard-redesign-djr3g2` (`src/lib/nav/places.ts`) | Personalization cards live in the Personalize place. No new top-level page. |
| Home: one note, four modules, one unlock ladder, **first-week card** (7 daily steps) | same branch | Onboarding hands off to Home. It feeds the "one note" slot; it does not add a second "what next" list. |
| **Unlock ladder** (5 rungs: full job detail and Community, Dossier taking shape, Candidate+, Recruiter introductions, Unposted roles) | same branch (`src/lib/unlocks/ladder.ts`) | This is the ladder users see. Do not introduce a parallel one. |
| **Effort in minutes** (1 point = 1 minute; Candidate+ needs 480 by default, admin override; grade no longer bypasses) | same branch (`effort-minutes.ts`, `dossier-targets.ts`) | Adopted as the "real motivation" measure. See "Effort" for one required fix. |
| **Personalization spine**: each question, what it drives, and a test that something reads it; new/merged journeys | `claude/candidate-features-journeys-y88lop` (`src/lib/personalization/spine.ts`) | The question list and the "situation" choices come from the spine and journeys, not from main's 9 cards. |
| Candidate Google client limited to `gmail.readonly` + `calendar.events.readonly` | `google-oauth-split` | Onboarding requests exactly those, plus `openid email`. Nothing else. |
| Onboarding stepper with minutes and "answers save as you go" | redesign branch (`stagedSummary`) | Reuse `stagedSummary` for time-left copy. |

Merge order matters. Build v2 on top of main after the redesign and journeys branches land, or
rebase onto them. Files both sides touch: `OnboardingStepper.tsx`, `DashboardNav.tsx`,
`dashboard/page.tsx`, `dossier-unlock.ts`, `effort-minutes.ts`, `search-strategy.ts`.

## The flow

### 1. Join (one screen)
- Primary: "Continue with Google." Small secondary: "Use email instead."
- Copy: free, searching is work, you get what you put in. Connecting also lets us verify your
  effort for employers.
- One consent covers sign-in, Gmail (read) and Calendar (read). Personal Gmail only: reject
  Google Workspace accounts (the `hd` claim) and non-gmail.com addresses.
- After return: check the granted scopes server-side. Missing scope = a soft re-ask screen,
  not a dead end. Declined or no personal Gmail = account created, dashboard opens with
  tracking off and a clear banner.
- Gated behind a flag until Google verification clears; until then sign-in only.

### 2. Read and ask (while the scan runs)
- The situation question (from the journeys branch) is asked as a one-tap card while the
  inbox scan runs.

### 3. Reveal
- What we found: applications, interviews, networking. Firm counts for what we are sure of,
  "about" for the rest.
- Then one primary action: "Make it yours (2 minutes)."

### 4. Make it yours: five cards
Titles are plain, there is no "chapter" or "step" label. Each card names its payoff and time.
The first two are the fast lane at onboarding; the rest appear one at a time as the Home
"next" note. Questions are taken from the spine; this mapping is provisional until the full
spine is read.

| Card | Spine group (provisional) | Payoff shown on the card |
|---|---|---|
| Your goal: role, level, industries, location, minimum pay, pivoting | want | Matched jobs and fit labels; which recruiters you are introduced to |
| Your plan: weekly effort, blockers, motivations, coaching style and pace | how | Your weekly plan; a sample nudge in your tone |
| Your dealbreakers: deal-breakers, culture, screening, work authorization | situation | Jobs filtered and flagged |
| Your strengths: resume, skills, personality assessment | who, proof | Your grade, skill gaps, learning plan |
| Your people: networking comfort, contacts from your inbox, 3 references | proof | Who to message first; the references the Dossier needs |

Where each lives after onboarding: Your goal, plan, dealbreakers = My search. Your strengths =
My story / My work profile / My profile. Your people = Network > References and Contacts.

The resume is optional. Market Reality grade shows "add your resume to see it" until then.

### 5. Hand off to Home
- Day 1 onwards the Home "first-week" card leads. Its day-5 step ("answer a few work-style
  questions") and day-4 step ("ask a reference") point into the cards above.
- One source decides the single "next" item on Home, so the first-week card, the unlock
  ladder and the personalization cards never compete.

## What the work earns (defined by the redesign branch)

- Candidate+: exclusive jobs, the Candidate+ mark recruiters and hiring teams can see,
  unlimited manual connection to the recruiter network.
- Recruiter introductions: we send the Dossier to recruiters with a fitting role.
- Unposted roles.
- Confidential members stay hidden.

Onboarding feeds this: the Your goal answers decide which recruiters count as "fitting".

## Effort

- The Dossier shows facts, not points: weeks active, outreach, applications, interviews,
  references. Inbox and calendar logging makes them verified rather than self-reported.
- Points stay as the weekly motivator and equal minutes of effort.
- **Required fix (for the redesign work to make):** `sumEffortMinutes` adds up every earned
  point in every sprint. Confirmed from the code: the Gmail/Calendar connect callbacks log
  GMAIL_CONNECTED and CALENDAR_CONNECTED (10 points each, 5 on reconnect) into the sprint list
  via `logCatalogAction`, and the first-sprint welcome bonus (5 points, `isGoalBonus`) is in
  the same list. Likely too, not traced: profile confirmations (5 each), mood check-ins (3),
  and community actions (5-30). Effort that employers see should count only job-getting
  actions: outreach, calls, follow-ups, applications, interviews, references, learning. Setup
  earns progress, not minutes.
- The action category cannot do the filtering: outreach and community actions share the
  "connecting" category, so use an explicit allow-list of action types. The weekly recap and
  finish-line emails already skip goal-bonus and profile-checklist rows
  (`isProfileChecklistActionType`), so there is a precedent to follow.
- Not changed here: `effort-minutes.ts` belongs to the redesign branch.

## Cuts and consolidation

- The Complete Your Profile page (20 items) folds into the cards. Its "confirmed" fields are
  filled from card answers so nobody answers twice. The page remains until the cards ship.
- The Search Strategy hard gate becomes a soft nudge.
- The 21 Search Strategy checklist points (they feed nothing) are removed.
- Questions with no reader are hidden until one exists (spine test enforces this).
  Candidates from a rough scan: `aiDisplacementReason`, `willingToFollowUpOnApplications`,
  `travelWillingness`, `canTeach`, `elevatorPitchReady`, `referralRecency`,
  `boardAdvisoryWillingness`. Verify before cutting.
- The 8-12 hrs/week contract moves from onboarding to the first Search Sprint.

## Open decisions

1. **Exclusive jobs: decided, keep the redesign.** They stay a Candidate+ unlock. Onboarding
   does not change this. (An earlier idea of showing them to everyone and attaching the Dossier
   to the application is dropped for now.)
2. **Apply with Dossier.** Not in scope while exclusive jobs stay gated. Revisit if that changes.
3. **Auto-apply for members.** Out of scope here. Recommendation is assisted apply (we prepare
   the packet, the member submits) as a separate project, not auto-submit.
4. **Supporters** (new in the redesign): decided, sign-up does not ask. They stay with
   first-week day 1.
5. **Friends and family tagging**: decided, tag by relationship (family, friend, professional,
   unknown) and exclude family and friends from activity counts and nudges, while keeping them
   available as warm contacts. Built after the cards, against the contacts model. Not designed
   in detail yet.
6. **Google verification status.** Not recorded anywhere in the repo (`docs/SETUP.md` still
   says no candidate OAuth is configured). Someone needs to check the Google Cloud Console.
   Until it clears, the new sign-up flow ships behind a flag.

## Spine gaps

The journeys branch's spine has 33 signals in five groups (who, want, how, situation, proof).
Most of the five cards map onto it directly: Your goal = `want`, Your plan = `how`, and the
situation card = `situation`. But `proof` holds only the skills assessment, so these have no
spine entry yet and need one (each with a `readBy` file, which the spine's own test enforces):
resume, personality/working-style assessment, references, LinkedIn, screening answers (work
authorization, background and drug test, non-compete), and interim-work availability. Adding
them to the spine is part of building Your strengths, Your dealbreakers and Your people.

## Built so far

- `src/lib/google/grant.ts` (+ `src/test/google-grant.test.ts`, 11 tests): reads which scopes
  Google actually granted and enforces personal-Gmail-only (Workspace accounts rejected by the
  `hd` claim). The personal-only rule is off for existing Connect buttons and on for sign-up.
- The existing combined Gmail + Calendar callback now checks the granted scopes before saving
  either connection. Before this, unticking one box still created both. New error codes have
  plain-language copy in `connect-error-copy.ts`. This is a behavior change on a live path.

## Build order

1. Rebase on main plus the two branches once they merge (none had merged at last check; the
   redesign branch was still moving). Spine read: done.
2. Join screen, scope check (done), personal-Gmail rule (done, not yet used), reveal (behind a
   flag).
3. Your goal and Your plan cards, as the fast lane.
4. Your dealbreakers, Your strengths, Your people.
5. Effort fix, soft gates, retire the old pages and the no-op points.

## Analytics

`onboarding_google_started`, `onboarding_google_completed` { scopesGranted, scopesMissing },
`onboarding_google_declined`, `scan_completed` { counts, durationMs }, `card_started` /
`card_completed` { card, source: fast_lane | home }, `card_skipped`, `ladder_rung_reached`
{ rung }. Server-side where the event only happens in a Server Action.

## Risks

- Gmail restricted-scope verification may not clear on the timeline; the flag covers it.
- Merge conflicts with the redesign branch in the files listed above.
- Auto-promotion to recruiters must honor privacy tier and Confidential Search Mode.
