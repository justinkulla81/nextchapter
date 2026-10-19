# Audit: Higher education ("higher ed v1") and the candidate redesign

Read-only audit, 2026-10-18. Read from the working branch `claude/candidate-dashboard-redesign-djr3g2` (HEAD 8a92cac6) and `origin/main` (4ae28002). Nothing was changed except this file.

## 0. Verdict in five lines

- The higher education portal is built and almost all of it is already on `origin/main` (about 112 files in `src/lib|components/higher-ed`, 43 route files under `src/app/i/[slug]`). It is large: eight workspaces, 21+ tables, nightly and weekly crons.
- `origin/higher-ed-portal` is a stale, superseded branch: its one unmerged commit (f7308f0f, Oct 10) has an equivalent already on main (5bdaac32, same title). Nothing needs rescuing from it. Do not merge it (it would delete files main still uses).
- Production has 0 organizations, so every college surface is empty in production. Only the demo colleges (`/i/demo`, Washington and Jefferson demo tenant) show data.
- The candidate-facing college pieces on the redesigned site are thin: a colored bar, a groups page, an alumni jobs page, a benefits network page, and a privacy card. The rich member experience lives inside the college portal (`/i/<slug>/candidate`), a separate shell in its own navy style.
- The redesign mockup already has "Alumni and groups" under Network. It does not yet have the college bar, college news, the stage panel, or the career status card.

## 1. What it is

### 1a. The portal (partner side, merged)

- Spec: `docs/specs/NextChapter_Higher_Ed_V1_Build_Spec.md` (457 lines; Implementation notes from line 329 are the build log). Product vision: `docs/PRODUCT_VISION_ADMIN_ORGS.md` (715 lines), `docs/partner-experience.md`, `docs/AFFILIATIONS.md`. No file named HIGHER_ED* exists (not found).
- One portal at `https://launchyournextchapter.com/i/<slug>`; also served at `highered.launchyournextchapter.com/<slug>` when the subdomain switch is on (`src/lib/org-hosts.ts`, `NEXT_PUBLIC_ORG_SUBDOMAINS`). Login: `https://launchyournextchapter.com/i/login`. Staff invites: `/i/invite`. The older `/institution` staff portal was folded in and removed.
- Workspaces (`src/lib/higher-ed/workspaces.ts`), tier-gated (Career, Advancement, Institution): Candidate, Alumni Relations, Development, Career Services, Teaching, Exec Ed, Employer, Admin, and a Workforce board (only if WIOA is switched on).
- Alumni Relations: roster import (CSV), branded join emails, composer and saved audiences, events and check-in, engagement tiers and editable weights, directory, groups and chapters, mentors, news.
- Career Services: caseloads, in-transition flags, check-ins (M6/M18/M24 and annual), layoff alerts matched to WARN notices, outcomes tab, employers (Basic/Featured), internships tab.
- Development: ROI lift, prospect signals, thank-you asks, Resilience Fund, CRM export, peer benchmark.
- Teaching and Exec Ed: programs, cohorts, enrollments, credentials with public verification (`https://launchyournextchapter.com/credentials/<id>`, Open Badges JSON), capstones.
- Admin: branding, launch checklist, services menu (15 module switches), privacy requests (FERPA download and delete), multi-campus systems at `/systems/<slug>`.
- Public pages: `/i/<slug>/join`, `/welcome`, `/for-alumni`, `/outcomes`, `/recruit`, `/rapid/<id>`, `/unsubscribe`, `/mentor/join`, `/checkin/<id>`, `/report/fund`.
- Email safety: Resend webhook, suppression, RFC 8058 unsubscribe. Crons: `/api/cron/higher-ed-nightly` (07:30 UTC) and `/higher-ed-weekly`.
- Consent model: staff read only SQL views that apply consent (`prisma/sql/higher-ed-views.sql`); an import never links a NextChapter account; the member joins, then picks sharing switches.
- Verification scripts: `npm run verify:he06|release2|release3|release4|v2|lifecycle|community|he-demo|email-safety`, `check:he-screens`.

### 1b. Candidate-facing parts

| Surface | Where | Status |
|---|---|---|
| College portal for members (tabs: Home, Jobs & projects, Internships, People, Mentoring, Learn, Give back, Coaching, Privacy) | https://launchyournextchapter.com/i/<slug>/candidate | merged, empty in production |
| Career status card ("I'm in transition", "I got a job", "I'm no longer looking") | `CareerStatusCard.tsx`, inside the portal Candidate home | merged |
| Stage panel "From <college>, for where you are" plus program recommendations | portal Candidate home (`lifecycle.ts`, `screens-lifecycle.tsx`) | merged |
| College bar (slim colored strip, program name, "Your <college> portal") | `CollegeBar.tsx`, mounted in `src/app/dashboard/layout.tsx` line 222 | merged |
| Employer program bar (sibling for outplacement) | `ProgramBar.tsx`, layout line 226 | merged |
| My groups (outplacement, colleges, alumni networks) | https://launchyournextchapter.com/dashboard/groups | merged, in Network menu |
| Alumni jobs | https://launchyournextchapter.com/dashboard/alumni-jobs (tab "From my groups" in Jobs) | merged; shows "Nothing here yet" when empty |
| Schools you attended, alumni counts | https://launchyournextchapter.com/dashboard/universities | merged, only a link from groups |
| Past jobs and alumni reviews | https://launchyournextchapter.com/dashboard/past-jobs | merged, not higher education (employer alumni) |
| Higher Education Benefits Network (discounts from universities, exec ed, associations; alumni can propose offers) | https://launchyournextchapter.com/dashboard/benefits-network, `/propose`, `/benefits-network-verify/<token>` | merged; reached only from Benefits |
| Who can see your situation (every connected college, what it sees) | https://launchyournextchapter.com/dashboard/privacy (`AffiliationVisibilityCard`) | merged |
| Alumni network options (opens at 5 members sharing a school or employer) | `AlumniNetworkOptions.tsx` on groups page | merged |
| Alumni intros, office hours, events, groups, mentors, milestones, projects and boards | inside the portal Candidate tabs | merged |
| College coaches (`Coach.institutionId`, offered first to that college's members) | https://launchyournextchapter.com/dashboard/coaching-match | merged |
| Journey sync: "I was laid off" anywhere opens the college flag; Landed starts the grace period | `src/lib/journey/apply.ts`, `transition.ts` | merged |
| Education entry used by early career (`EducationForm`) | early career page | merged |

Wired or empty: the code paths are wired to real tables; the data is empty (0 organizations). Demo data exists only through `demo-seed.ts`, `demo-tenants/washjeff.ts` and `demo-community.ts`, plus the demo engine for partner portals.

### 1c. Not built (per the spec notes)
Resend open/click reporting is built; paid coaching via Stripe and the revenue-share report, fund award redemption on booking, college SSO beyond Google/Microsoft, live CRM and Handshake connectors, wage-record matching, AI-drafted outreach, VIEWER seats. Student first-job invitations exist; there is no student path without a joined college (journeys.md line 276).

## 2. Where it fits in the redesign

Menu from `src/lib/nav/redesign-places.ts`. Rule applied to every row: first strip is personalization on Home, Jobs, Network, Learn; one headline and one primary action; at most three sections; every claim says why.

| Higher education piece | Redesign place and entry | What it needs |
|---|---|---|
| College bar | Not a place. Becomes a small "with <college>" line in the top bar, beside the program name | Drop the full-width colored band (see section 3). Keep text link to the portal. Merge ProgramBar and CollegeBar into one "Your programs" component |
| My groups (colleges, outplacement, alumni networks) | Network > "Alumni and groups" (mockup `network/circles/alumni`). Today it is a tab "Groups" under Network in `redesign-places.ts` | Rename to "Alumni and groups"; one headline; cards say why each is a warm door (counts); one primary action "Join a group". Remove the three plain sections and the extra schools link |
| Schools you attended (`/dashboard/universities`) | Network > Alumni and groups, as a section inside it | Not a tab. Merge into the groups page; ask the school once (one home per fact) |
| Alumni jobs | Jobs > Find a job, as a "From your groups" filter or tab inside the job list, not its own menu entry | Currently its own tab in Jobs (`legacy('/dashboard/alumni-jobs')`). Use the job row contract: verdict plus reason ("Posted for Ohio State alumni"), Save and Apply. It is a plain link list today |
| Career status card | Home > Your week. Its job (stalled, laid off, got a job) is the one note on Home, or the check-in | Must not become a second note. Merge with the check-in in three tones; "I got a job" leads to Jobs > Offers |
| Stage panel "From <college>, for where you are" | Home strip content for members of a college, and the matching Jobs, Network or Learn strips | It is the college's version of personalization; do not add a card. Fill existing strips with college items and say why ("because you are in Applying") |
| Programs, program recommendations, courses | Learn > Skills and courses, as a source labeled with the college | Each recommendation states its reason (the gap area it fills), as the redesign requires |
| Mentors, office hours, alumni intros | Network > Alumni and groups and Network > This week | Keep consent wording ("emails swapped only on accept") visible |
| Events, news | Network > This week (one line), not a Home card | Home carries one note only |
| Higher Education Benefits Network | Finances and benefits > Benefits and deadlines (already `alsoMatches: /dashboard/benefits-network`) | Only shown when the member opts into money help. It is a discount catalog, not a deadline; see section 3 |
| College coaches | Network > Close circle (coaching) | Already unified; label "from your college" |
| Who can see your situation | Account and privacy > Privacy | Fits. Add each college's switches here, so the portal's Privacy tab and this page are one thing |
| Resilience Fund award | Finances and benefits (only the member sees it) | Prepaid coaching is shown "on their Coaching tab" today; money rule says opt-in |
| Internships | Not on the member board by design (`6f681c8b`); lives in the portal Internships tab | Keep out of Jobs. Add a pointer in Early career plan, for members of a college only |
| Credentials (Open Badges) | Account and privacy > Documents, or Learn | "No badges" rule: call them credentials; do not show as badges |
| Portal Candidate home itself | Stays a partner-hosted shell; do not duplicate it | See section 3, the redesign sentence "Partner portals follow the same system once the candidate site is done" |

## 3. Conflicts with the redesign decisions

1. College bar, `src/components/higher-ed/CollegeBar.tsx` and `ProgramBar.tsx`, mounted at `src/app/dashboard/layout.tsx:220-226`. Rule broken: one action color (orange) and navy only for the unlock moment. A full-width bar in the college's accent color (default `#2e7d5b`, green) puts a third color on every page. It also repeats on every page. Do: a text line or small mark, in the NextChapter palette; keep the college logo only. Partner colors belong inside the portal, which the owner already allows ("with the partner's logo and colors").
2. Wording "Higher Ed", rule: user-facing "Higher education". Found: `src/app/dashboard/layout.tsx:220` (code comment only), `screens-internships.tsx`, `InternshipTracking.tsx` (check for visible text). Commit 1df82c83 on the redesign branch already changes the user-facing text; confirm after it lands. Not found elsewhere in `src/app/dashboard`. Counting: what-you-asked-for item 21 says other pages still say "Higher Ed".
3. `src/app/dashboard/benefits-network/page.tsx` title and heading "Higher Education Benefits Network". Conflicts: one headline plus a paragraph of explanation and a filter bar of six filters (function, level, format, cost, time, credential) plus a join-wall box plus listing cards. Violates three-sections and "every claim says why" (it says "the institution carries the quality" with no fact). Also "Propose an offer" is a second action. Do: open on "Programs that fit your skill gap" (it already computes `findMatchedSkillGap`); filters behind "Show more".
4. `src/app/dashboard/groups/page.tsx`: three sections (program, colleges, alumni networks) plus the options panel plus a schools link, each with its own heading; "Open portal" and join actions compete. No reason line. Rule: one headline, one primary action, at most three sections on first view, every claim says why.
5. `src/app/dashboard/alumni-jobs/page.tsx`: plain link list with no verdict or reason; not the redesigned job row (title, verdict with reason, one fact, two actions). It also uses `max-w-2xl` and `text-xl` rather than serif display headings. It has an empty state with no next action.
6. Fonts and style: the college portal (`src/components/higher-ed/*`, `WorkspaceRail.tsx`) uses the old navy partner shell. Not a conflict while partner portals follow later, but the portal's Candidate home is what members actually see and it breaks "serif display plus Inter" and "navy for one unlock moment only".
7. Candidate tabs inside the portal (`workspaces.ts` line 100-115): nine tabs (Home, Jobs & projects, Internships, People, Mentoring, Learn, Give back, Coaching, Privacy). The redesign says one small tab row per place and names the same places differently ("People" vs Network, "Learn" vs Learn). A member sees two parallel menus. Do: members of a college should get one menu (the candidate site) and the portal's candidate view should be a filtered view of it, not a second app.
8. Stage names: the portal stage panel reuses "Exploring, Preparing, Applying, Interviewing, Offer, Landed, Paused" as visible headings ("From <college>, for where you are"). The decision is "no stage stepper". Using stages internally is fine; do not show a stepper or stage labels to members.
9. Badge-like items: engagement tiers and points exist for staff ("Low/High" tiers, CASE points); keep them staff-side only. Do not surface to members (rule: no badges, points explained once, "1 point = 1 minute").
10. Notes on Home: the portal Home carries college news, a Give back card, a "My program" card, a status card and the stage panel (at least four cards). Rule: one note on Home only. See section 2 for where each one goes.
11. Money opt-in: the Benefits Network and the Resilience Fund are money-adjacent. `redesign-places.ts` puts `benefits-network` under Finances and benefits, which is only shown when the member chose money help. A learning discount is not a financial hardship item; consider also linking it from Learn.
12. Give back / donation asks to alumni (`/i/<slug>/give`, "Give back" tab). Not a conflict with a redesign rule, but conflicts with the always-positive, job-first brief for members in transition; the code already holds asks while do-not-solicit (in transition). Keep that rule as a hard requirement.

## 4. Old, duplicated, dead, or at odds

- `origin/higher-ed-portal`: stale; its only unmerged commit is superseded by 5bdaac32 on main. It diffs 70 files and would remove `src/app/institution/*` and re-add older code. Safe to delete the branch after the owner agrees. Not touched here.
- `/dashboard/universities` and the schools list in `/dashboard/groups`: two pages for one idea; the audit already says "Only a link from My groups". Merge into one.
- `/dashboard/past-jobs` (alumni of employers and past-job reviews) is employer alumni, not higher education. It shares the "alumni" word with college alumni; it belongs with Network > Alumni and groups (as the mockup lists) or Jobs > Companies, not under colleges.
- Two ways to join a group: `AlumniNetworkOptions` (self-formed networks, five members minimum) and college groups/chapters (`AlumniGroup`, leader-run). Different mechanisms, same label "groups". Name them differently ("Alumni network" vs "College group") or merge.
- Two privacy surfaces: `/dashboard/privacy` (AffiliationVisibilityCard) and the portal Privacy tab (four switches plus "Who viewed my profile"). Same facts in two places; the redesign says one home per fact.
- Two status mechanisms: portal buttons ("I'm in transition", "I got a job") and the main check-ins ("Still searching?" dialog). The spec says they are one system, but the UI is two. The redesign merges the mood pop-up and "Still searching" into one check-in; the college buttons should call that same flow.
- `ProgramBar` and `CollegeBar` are the same pattern twice.
- Internal naming: `/institution` routes, "Institution" in code, "College" in many screens; user-facing should be "college" or "Higher education" consistently. Not found: a single glossary file.
- Candidate-side page for internships: deliberately none (decided). Do not revive.
- The "Workforce board" workspace and `OrgKind = 'workforce'` live in the same code as colleges. The owner said workforce is another session's; keep out of this scope.
- The `docs/candidate-feature-map.md` lines 35, 64, 65, 103 list these pages as "Only a link from"; the redesign mockups table should replace them (alumni, groups, universities, past-jobs all map to one Network screen).

## 5. New ideas the work raises

Candidate side
- Make "your college" a first-class circle in Network > Alumni and groups (the mockup shows "2,840 alumni, 31 work at companies hiring for your role"). The data for "N alumni work here" exists (`alumni-jobs`, roster employer or consented employment); use it as the proof line on a job row ("2 alumni work here") and the Companies profile.
- Warmer introductions strip (Network): alumni intros at a company already exist (`AlumniIntroRequest`, five open asks); feed them into the Network strip with the reason.
- A "From your college" source filter in Learn and Jobs, not a new page.
- Show the college only where it helps the member decide; hide the rest. A member with three schools (the brief says people belong to many) needs a picker, not three bars.
- Receipt-style payoff for joining: "Joining Ohio State shows you 6 jobs and 31 alumni in your field" before they accept (the redesign wants payoff shown before the question).
- Students and new grads without a joined college: a path to ask their school to join (journeys.md line 276 gap). Also graduation year computes nothing today; use it for "months to graduation" in the Early career plan.
- Consent summary as a sentence at join: "<College> sees only whether you land, if you choose" (already the portal wording; reuse in Account and privacy).

Partner side
- The college sees an aggregate "how the redesign plan is going" for its alumni (counts above MIN_CELL_SIZE, never names): fits the Effort and results idea.
- Make the portal Candidate home a skin of the same candidate pages (logo, name, color from Admin branding) so members have one product; staff keep their tier-gated workspaces.
- Shared component for partner mark (logo and name) across `PartnerBrandMark`, `InstitutionMark`, `ProgramBar`, `CollegeBar`.
- Apply the same personalization-first approach to staff: "Waiting for you" (already built, `inbox.ts`) is the staff equivalent of the one note.
- Weekly progress email: college version using the redesign's email design (no badges), sent by the college's name.

## 6. Incorporation steps, in order

1. Decide the fate of `origin/higher-ed-portal` (stale; delete after owner confirms). Do not merge.
2. Confirm 1df82c83 ("say Higher education in user-facing text") lands on main, then grep for remaining visible "Higher Ed" (portal screens, internships, emails).
3. Replace `CollegeBar` and `ProgramBar` in `src/app/dashboard/layout.tsx` with one small "Your programs" line in the top bar (text and logo, NextChapter palette). One component, tested against 0, 1 and 3 memberships.
4. Build the Network > Alumni and groups screen for real (mockup `network/circles/alumni`): merge `/dashboard/groups`, `/dashboard/universities`, `/dashboard/past-jobs` links; first strip is "Warmer introductions"; one primary action "Join a group"; every group card gives a count and a reason. Empty state for 0 organizations (production today).
5. Fold `alumni-jobs` into Jobs > Find a job as a "From your groups" filter on the redesigned job row; drop its menu tab in `redesign-places.ts`; add the "N alumni work here" proof.
6. Rework `/dashboard/benefits-network` as a Learn or Finances and benefits entry: matched-to-skill-gap first, filters behind "Show more", one action; link from Learn too. Update `redesign-places.ts` and `src/test/redesign-places.test.ts`.
7. Move the career status card and college check-ins into the one Home check-in (three tones); route "I got a job" to Jobs > Offers; keep do-not-solicit on "in transition".
8. Put the stage panel and program recommendations into the strips (Home, Jobs, Network, Learn) as college-sourced items with reasons; remove stage labels from member view.
9. Merge the privacy surfaces: portal Privacy tab content appears under Account and privacy > Privacy, per college.
10. Add a dev-preview screen for a member who belongs to a college (college line, groups with real-feeling counts, a college item in each strip), screenshot, owner review, then wire data (per `docs/candidate-redesign.md`: prototype in `src/app/dev-preview/` first).
11. Fire PostHog events for each new candidate action (join group, open alumni job, college item opened, benefit offer redeemed) with `{ institutionId, source, listingId }`; the portal already fires `he_*` events (community-actions, service opens via `/i/<slug>/go/<service>`). Per CLAUDE.md, instrument at build time.
12. Later, after the candidate site: restyle the portal in the partner shell (serif plus Inter, partner logo and colors), reduce the portal's Candidate tab set to match the five places, and seed one real pilot college so production is no longer empty (no first college is recorded: not found).

## Not found
- Any HIGHER_ED*.md doc; any dev-preview screen that shows the college bar, status card or stage panel; any candidate-facing page that shows a "College benefits" menu entry by that name (the item is "Money and benefits" with `/dashboard/benefits-network` as `alsoMatches`); a production college.
