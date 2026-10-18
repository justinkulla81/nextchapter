# What the other sessions built, and how it fits the redesign

Audit of 2026-10-18. One file per body of work sits beside this one. Each lists what exists, where it lives, what fits, what conflicts, what is old, and new ideas. This page pulls out what needs a decision.

## Which work is which

| You said | What I found | Where | Confidence |
|---|---|---|---|
| Higher ed v1 | The higher education portal | On `main`. `origin/higher-ed-portal` is stale (its one commit already exists on main) | High |
| Career pivot tool | Pivot paths, "What would it take", "Thinking about a pivot", career story | Merged into this branch from `claude/compassionate-edison-fkfdu5` | High |
| Journey personalization | The personalization spine, signals, retune, the 11 journeys | On `main`. `PersonalizationQuestion` is only on `origin/claude/awesome-dijkstra-14oi6p` | High |
| Market reality report | The grade, report, market pages, monthly member report | On `main`. The Employment Report rename branches are superseded | High |
| Career team | Employer career growth seats. No feature is called "Career team". | On `main` and merged here | Medium |
| Career Team and Fit Future | Two outside companies (CareerTEAM, a case-management vendor; FutureFit AI, a career-pathing company). The session compared them and the owner chose what to build: the pivot tool, training matching, résumé editor, documents, coach booking and notes, white-label. Merged on `main` (PRs #27, #34, #42) | `docs/session-audit/career-team-fit-future.md` | High |
| Consulting experience screening | One Search Strategy question (consulting, expert network, fractional, part-time: doing it, done it, not yet), merged as PR #46. It has nothing to do with the market report. | `docs/session-audit/consulting-screening-session.md` | High |
| Personal assistant | A spec only, on `origin/claude/peaceful-ride-8ib5z2`. No code | | High |
| Finding future opportunities | "Likely openings", layoffs, USAJOBS, hot alerts, backchannel, the jobs report | Part on `main`, part on about eight small branches | High |
| Gmail and calendar onboarding | Onboarding v2: Google sign-up and scan reveal, behind a flag | `origin/claude/optimistic-goldberg-fxjmxq`, never run against real Google | High |
| "nextchapter" | Still unidentified | | Please tell me |

## Conflicts that need a decision

1. **The grade breaks "always positive".** The member sees letters A to F, red for D and F, and F means "weaknesses serious enough to end most conversations". It sits on Home, Stats and the report. I recommend no letter is shown to members.
2. **The personal assistant spec clashes in five places.** An "Ask Victoria" tab, a separate `/assistant` app with its own Today, many proactive pushes, an always-on money pillar, and urgency and negative stats. It also lists 8 journeys, not 11. I recommend the assistant is a layer with no menu entry that picks the one note on Home.
3. **Two onboarding flows.** The new Google-first onboarding and the question bundles O1 to O6. The scan reveal can follow O1 and O6, but cannot replace the résumé step. There are also three overlapping flags (`CANDIDATE_REDESIGN`, `ONBOARDING_V2`, a Gmail tester gate).
4. **The college bar** is a full-width bar in the college's accent color on every page, against one action color.
5. **Stage panel** inside the higher education portal, against no stage stepper. Its Home has about four cards, against one note.
6. **Experience findings** use "reviewer objection" and "development area", which reads as judging the member, and the rating marks act as badges.
7. **Unsourced claims:** "usually means senior hires in the next few months" and a bare "Medium" competition tile on job rows, and interview odds for each grade.
8. **Fresh jobs has four voices** (the nav badge, the alert, the daily email, the board). People-you-know and new-jobs have four emails.
9. **Sponsor cards on Home:** `StaffProgramCard` and `SeatEndingBanner` add cards beyond the one note.

## Bugs found

- A Learning seat is described as outplacement in the employer overview and the seat-ending banner (`programKindOf(journey)`).
- Saved pivot targets never set `targetFunction` or `isPivoting`, so the question "Open to a change?" needs one source of truth.
- The menu rule hides money for members staying in a job. The redesign now shows Finances and benefits for every journey unless the member said no.
- A stale "no WARN data exists" comment in the company page.

## Old or does not fit

- Docs that still say 8 journeys, "six places" or "Personalize": `CANDIDATE_JOURNEYS_AND_FEATURES.md`, `CANDIDATE_MENU.md`, the career story docs, the onboarding v2 spec's "Make it yours" cards.
- `origin/ai-skills-taxonomy` (a retired draft), `origin/higher-ed-portal` (stale), the Employment Report rename branches (superseded), `geo-pitch-1008` and funding opportunities (admin only, not for candidates).
- The jobs-report crawler scripts do not belong in the app repo.

## New ideas these raise

- One ranked suggestion object, with its reason, behind the note, the email and the receipts.
- A receipt for every drafted message.
- "N alumni work here" as proof on job rows, and a "from your college" filter.
- Two equal doors at sign-up: Google or résumé. The scan reveal as a Home card that fills in. Correctable counts.
- Log how long from a signal to a posting, so "usually" becomes a sourced fact.
- A quiet mode when a check-in is low. Coaching style sets how far the assistant reaches.
- A supporter who approves a draft.

## Done in the redesign because of this audit

- The redesign menu no longer locks Find a job and Network behind Gmail.
- "Open roles at your company" and "Courses your company covers" are in the menu for staff-program members.

## Decisions for the owner

1. Which of the unclear sessions did you mean: fit future, consulting experience screen, "nextchapter"?
2. Is any letter grade shown to members? (Recommended: none.)
3. Is the assistant a layer behind the one note, with no tab or name for now? (Recommended: yes.)
4. Onboarding: question bundles O1 to O6 first, with the Google scan as a reveal step after O6?
5. College bar: neutral navy with the college's name and logo only, or keep their accent color?
6. Delete the stale branches (`higher-ed-portal`, `ai-skills-taxonomy`, the Employment Report rename branches)?

## Corrections after reading the session transcripts

See `transcripts-other-sessions.md`. In short: the market report redo exists (`origin/claude/friendly-noether-118syi`, PR #83, session still active); the career events SQL was already applied to production on 2026-10-17; mood is never shared (decided); the Google onboarding session is waiting on the owner's A, B or C choice for the Your goal and Your plan cards (the redesign's journey card and Build your plan strip are that idea); exclusive jobs for everyone with the dossier attached is an owner statement that conflicts with gating behind Candidate+; the assistant's name, 'free' and the paid recruiter channel are the assistant's readings, not owner decisions; the Higher Ed session edited a design artifact (services menu, donations, digital resources, WIOA funding) and did not write code.
