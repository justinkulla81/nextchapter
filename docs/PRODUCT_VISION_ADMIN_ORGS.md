# NextChapter — Non-Candidate Portals & Backend Systems

Zero-context handoff doc covering everything in the app that is **not** the candidate-facing
dashboard/onboarding flow: the internal admin portal, the coach portal, the recruiter portal, the
employer/hiring-manager portal, the NC Job Board submission pipeline, the Employer Reference
feature, the Market Pulse, weekly digest emails, the cross-portal messaging system, and the
org-facing marketing/landing pages.

Stack: Next.js App Router (route groups + Server Actions), Prisma ORM against Postgres, Supabase
Auth (session cookies for most portals; a handful of surfaces use a bare `accessToken` on the
model instead of a Supabase session — noted explicitly below wherever that's the case). All file
paths below are relative to the repo root at `/Users/salitkulla/nextchapter`.

---

## 1. Admin portal — `/support/admin` (NOT `/admin`)

Internal, employee-only tools. Gated by `requireAdmin()` in `src/lib/admin/auth.ts`, which checks
the logged-in Supabase user's email against a comma-separated `ADMIN_EMAILS` env var — there is no
roles table; this env var allowlist is the entire admin auth model today. Logged-out visitors are
sent to `/support/admin/login`; logged-in non-admins are sent to `/dashboard`.

Layout: `src/app/support/admin/(portal)/layout.tsx` calls `requireAdmin()` and
`getAdminHomepageSummary()` (`src/lib/admin/homepage-summary.ts`), then renders
`AdminNav` (`src/components/admin/AdminNav.tsx`), which is the authoritative map of every page in
the portal, grouped into five nav sections: Candidates, Coaches, Hiring Managers, Recruiters,
Admin.

### Home — `src/app/support/admin/(portal)/page.tsx`
Three sections, all pulled from `getAdminHomepageSummary()`:
- **Needs your attention** — counts of pending Job Board listings (`ExclusiveJobPosting` where
  `status: pending, archivedAt: null`), pending Offer Bonus claims (`BountyClaim` status
  `PENDING`), unresolved reference disputes (`Reference` where `candidateDisputedAt` set and
  `disputeResolvedAt` null), and pending Job Board intro requests (`JobBoardIntroRequest` status
  `pending`).
- **Last 7 days** — new candidate signups (`registrationCompletedAt` in last 7 days), new Job
  Board listings, new recruiter database opt-ins.
- **At a glance** — total/registered candidates, this week's A-List count (sourced from
  `WeeklyBadgeEarned` where `badgeKey: WEEKLY_SCORE_A_LIST` — **not** the legacy
  `SundayNightReport.onAList`, which nothing writes to anymore), coach/recruiter/hiring-manager
  counts, live Job Board listing count.

### Candidates — `.../candidates/page.tsx`
Paginated, filterable (`AdminFilterBar` + `AdminDataTable`, `src/lib/admin/pagination.ts`) table of
every `CandidateProfile`: name, email (resolved via `listAllAuthUsers()` /
`src/lib/admin/auth-users.ts`, which lists all Supabase auth users once and joins in memory),
current job status, search intensity, primary function, level, most recent Exec Dossier grade
(from `hireabilityReports`, normalized via `normalizeGradeSnapshot`), and recruiter-database
opt-in. Filters: status, intensity, level, opted-in.

### Candidate detail — `.../candidates/[id]/page.tsx`
Backed by `getAdminCandidateDetail()` (`src/lib/admin/candidate-detail.ts`). Shows: targeting
(role/function/industries), full grade history, assigned coach + dossier-consent status + recent
sessions, job activity (tracked applications, surfaced matches, job-board clicks), a live
**job recommendations** panel — `rankPendingPostingsForCandidate()`
(`src/lib/jobs/job-fit-bucket.ts`) ranks every *pending* `ExclusiveJobPosting` by fit score for
this specific candidate, and an inline "Approve" button calls the same `approveJobPosting` action
used on the Job Board page — references, work samples, work history, and a sentiment-over-time
chart (`MotivationChart`). A sentiment alert banner appears if trailing-14-day mood check-ins show
a declining trend or a low average.

### Declined Commitment — `.../candidates/declined-commitment/page.tsx`
Candidates who reached the "I Commit" step in onboarding and explicitly clicked "Not right now"
(`contractAccepted: false` but `contractAcceptedAt` is set — both accept and decline stamp this
timestamp, so filtering on `accepted: false, acceptedAt: not null` isolates real declines from
people who simply haven't reached that step yet). A real, actionable follow-up list, not a
drop-off metric.

### Sentiment — `.../sentiment/page.tsx`
Every candidate sorted by trailing-14-day mood sentiment (0–100), via
`getAllCandidateSentiment()` (`src/lib/admin/sentiment.ts`). Sortable by name, sentiment, grade,
jobs-applied count, networking-done count. Flags a `lowSentiment` alert per row.

### Pacing — `.../pacing/page.tsx`
Two views on one page. (1) A per-candidate table of weekly points earned vs. the target needed for
an A grade this week (`pointsNeededForA()`, `src/lib/weekly/action-effort.ts`), with a
**reconciled** points calculation (`reconciledWeeklyPoints()`) that treats certain one-time
confirmation actions (profile/industry/function/salary/work-auth confirm) as backed by a real
profile timestamp rather than trusting the possibly-stale `committedActions` JSON blob alone.
Filterable by employment-status segment, sortable, searchable. (2) An **action activity** table —
every canonical Search Action type (`CANONICAL_TASK_MENU`), how many times it's ever been
completed across all candidates, and how many this week, independently sortable.

### Layoff Cohorts — `.../layoff-cohorts/page.tsx` + `actions.ts`
Live nav link (un-greyed in the Community rework) — creating a cohort or confirming a match now
also creates/updates the matching `Community(type: EX_COMPANY)` row and fires the candidate's named
auto-join notice (`src/lib/community/communities.ts`).
Groups candidates from the same layoff event so they can find each other in Community. Admin
creates a cohort (company, layoff date, estimated size, news URL) via `LayoffCohortForm`. The page
computes **suggested matches**: unassigned candidates (`currentJobStatus: LAID_OFF,
layoffCohortId: null`) whose `workHistory` company name fuzzy-matches the cohort's company name
(`companiesMatch()` — substring match either direction, case-insensitive). Admin confirms matches
one by one (`LayoffCohortMatchRow`); cohorts can be deactivated.

### Weekly Recognition Archive — `.../weekly-recognition/page.tsx`
Read-only archive of who made the A-List and earned badges, week by week — from
`getWeeklyBadgeArchive()` (`src/lib/badges/weekly-badge-archive.ts`), sourced from the real,
currently-written `WeeklyBadgeEarned` table.

### Offer Bonus Claims — `.../bounty-claims/page.tsx` + `actions.ts`
Review queue for the $500 "got hired" bounty. Loads every `BountyClaim`, resolves the candidate's
auth email, and generates a 10-minute signed Supabase Storage URL for the uploaded offer letter
(`offer-letters` bucket). Split into Pending / Reviewed. Actions: `approveBountyClaim`,
`rejectBountyClaim` (with a reason), `markBountyClaimPaid`.

### Employer References — `.../employer-references/page.tsx`
Read-only table of every `EmployerReferenceSubmission` (the "Give a Reference" feature — see
section 6). Columns: submitted date, employer (submitter name/company/email), departing employee
name/email, status (`pending`/`claimed`/`declined`), and a layoff-signal column showing whether
`isLayoffContext` is set and whether the founder-notification / Attio-sync markers have fired. Code
comment notes this is one of only two places a pending submission is even visible — the submitting
employer sees their own, and this page. No write actions exist here yet.

### Coaches — `.../coaches/page.tsx`, detail `.../coaches/[id]/page.tsx`
List: name, firm, work email, focus, whether they have a real login (`userId !== null`, vs.
token-only access), client count, joined date. Detail: full client list with dossier-consent
status, recent sessions.

### Coach Matches — `.../coach-matches/page.tsx`
Caseload distribution across coaches, via `getCoachMatchDistribution()`
(`src/lib/admin/coach-matches.ts`). Flags (banner only, no automated rebalancing) any coach whose
client count exceeds 2x the roster average.

### Hiring Managers — `.../employers/page.tsx`, detail `.../employers/[id]/page.tsx`
List of every `EmployerProfile`: contact, company, email, subscription tier, roles posted, joined.
Detail: subscription tier/status, No-Ghosting Commitment acceptance, roles posted, Job Board
submissions.

### Job Board (admin review queue) — `.../exclusive-jobs/page.tsx` + `actions.ts`
The trust gate for the entire NC Job Board — see section 5 for the full submission pipeline. This
page:
- Lets an admin **manually add** a posting via `ExclusiveJobPostingForm`, including an
  **"Autofill from URL"** step (`autofillJobPosting` action) that fetches the real posting page
  (`fetchJobPosting`, same blocked-domain handling the candidate Job Fit tool uses) and runs it
  through an LLM extraction pass (`extractPostingFields`) to pre-fill title/company/location/salary
  — everything stays editable. Manually-added postings save straight to `approved` (admin has
  already vetted them) with `source: 'admin'`.
- Shows the **Pending review** queue two ways: grouped **by company** (collapsible, with bulk
  Approve-all/Reject-all per company or globally — `approveAllPendingJobPostings`,
  `approveAllPendingForCompany`, `rejectAllPendingJobPostings`, `rejectAllPendingForCompany`), and
  **by fit** (a flat table sorted by how many candidates in the pool are a plausible match,
  computed via `countPendingJobMatches()` / `rankCandidatesByFitCoverage()` in
  `src/lib/jobs/job-fit-bucket.ts`). Each posting card shows a completeness signal (named contact
  present/missing, salary band present/missing) and a confidentiality warning if `disclosure:
  CONFIDENTIAL`.
- Shows **Active** postings with per-posting Archive and "Still open — confirm" (re-stamps
  `expiresAt` +30 days) actions.
- Shows **"Candidates with the fewest options"** — the 10 candidates worst-served by the current
  active board (fewest good-fit live listings), a sourcing prompt for the admin, excluding
  `EXCLUDED`-distribution rows (private candidate job-fit-check mirrors that were never a real
  option for anyone).
- Shows **Archived/rejected**, grouped by company.
- Every posting carries a visibility model — `audienceTier` (ALL_CANDIDATES / A_LIST_ONLY),
  `distribution` (OPEN / TARGETED / EXCLUDED — EXCLUDED is recruiter-only), `disclosure` (OPEN /
  CONFIDENTIAL — CONFIDENTIAL is recruiter-only, hides the company name from candidates).

Key actions (`exclusive-jobs/actions.ts`): `createExclusiveJobPosting`,
`archiveExclusiveJobPosting`, `approveJobPosting`, `rejectJobPosting`,
`reconfirmJobPostingAdmin`, bulk approve/reject variants, `autofillJobPosting`,
`previewJobPostingFit` (live fit preview while filling the manual-add form).

### Recruiters — `.../recruiters/page.tsx`, detail `.../recruiters/[id]/page.tsx`
Mirrors the Coaches list/detail pattern: name, firm, work email, specialty, login type,
submissions count, joined; detail shows every Job Board submission with disclosure/status.

### Recruiter Database — `.../recruiter-database/page.tsx`
Every candidate with `recruiterDatabaseOptIn: true` — name, email, function, level, target role,
industry, geo (+ remote/relocation flexibility), resume ATS score, Exec Dossier grade, A-List
badge, privacy tier, opt-in date. Fully sortable. Important business rule surfaced directly in the
page copy: **opting in is necessary but not sufficient** — a candidate is only actually matched to
roles ("currently surfaced") while holding an **A** Exec Dossier Grade
(`currentlySurfaced: execDossierGrade === 'A'`); everyone else shows as opted-in but locked.

### Requests — `.../requests/page.tsx` + `actions.ts`
Unified inbox aggregating five request types into one table via `getAdminRequests()`
(`src/lib/admin/requests.ts`): premium coaching requests, recruiter opt-ins, reference disputes,
Offer Bonus claims, Job Board intro requests. Every row links to its "real" source page for
resolution except Job Board intro requests, which resolve inline here
(`markJobBoardIntroRequestStatus` → `contacted` / `closed`) since that's the only request type
without its own dedicated admin page.

### Jobs (rollup) — `.../jobs/page.tsx`
Aggregate stats only, via `getJobsRollup()` (`src/lib/admin/jobs-rollup.ts`): tracked-job funnel
(applied/interviewing/offered), surfaced-job reactions (interested/not-interested + not-interested
reason breakdown), Job Board totals (pending/approved, by source), and job-click analytics (by
company, by title, and the 50 most recent clicks).

### Action Counts — `.../action-counts/page.tsx`
Server-tracked PostHog-style event counts (`getActionCounts()`, `src/lib/admin/action-counts.ts`),
filterable by date range and candidate segment, searchable by event name. Explicitly notes
client-side events aren't mirrored here.

### Site Metrics — `.../metrics/page.tsx`
Investor-data-room metrics computed live from real data (`computePreSeedMetrics()`,
`src/lib/admin/metrics.ts`): funnel, quality, market response, health, "Victoria performance"
(the AI coach), and demand-testing tables, plus an auto-generated investor proof point once 50
candidates reach Week 4+.

### Dashboard Messages — `.../messages/page.tsx` + `actions.ts`
CRUD for `DashboardMessage` — the pinned/rotating announcement banners candidates see on their
dashboard. One message is always pinned (the original "How NextChapter works" message); new
messages created here are never pinned by default, just added to the active rotation. Actions:
`createDashboardMessage`, `toggleDashboardMessageActive`.

### Market Pulse — `.../research/page.tsx` + `actions.ts`
Full triage UI for `ResearchLibraryItem` — see section 7 for the ingestion pipeline. Shows Gmail
inbox connection status (connect/disconnect), a manual "add URL" quick-submit form
(`AddResearchItemForm` → `addResearchItem` → `ingestResearchUrl`), a contradicts-locked-decision
alert banner, and a filterable/searchable table (bucket, status, credibility tier) with per-row
actions: queue/unqueue for digest (`MARKET_BRIEF` bucket only), flag to copy owner
(`PRODUCT_POSITIONING` bucket — sends an email via `sendProductPositioningFlagEmail`), and
mark reviewed/actioned/dismissed.

### Weekly Market Digest — `.../digest/page.tsx` *(nav shows "Coming soon", disabled)*
Two panels: items currently queued for the next digest send (pulled from the Market Pulse's
`queuedForDigest` flag, with a "remove from queue" action), and send history per audience
(candidate/coach/recruiter/employer), filterable. See section 8 for the actual sending crons.

---

## 2. Coach portal — `/support/coach`

For independent career/executive coaches whose clients use NextChapter. Two parallel access
models coexist:
- **Session-based** pages (`/support/coach`, `/support/coach/messages`, `/support/coach/invite-client`,
  `/support/coach/settings` root) — a real Supabase-authenticated `Coach` row (`userId` set),
  reached via normal login/signup (`/support/coach/login`, `/support/coach/signup`).
- **Token-based** pages (everything under `.../caseload/[token]`, `.../clients/[token]/...`,
  `.../invite/[token]`, `.../settings/[token]`) — resolved via `getCoachByToken()`
  (`src/lib/coach/access.ts`) against `Coach.accessToken`, no session required. This is the older
  access model, predating full Supabase auth; still the primary URL shape for client-detail pages
  and is what a coach's dashboard links point at (using their own `accessToken`).

Layout: `src/app/support/coach/(app)/layout.tsx` → `getCurrentCoach()`
(`src/lib/coach/current-coach.ts`), renders `CoachNav` with unread-message and stalled-client
badge counts.

### Home — `.../(app)/page.tsx`
"Needs your attention" (stalled clients — `getCoachCaseload()` flags anyone matching an
avoidance-pattern heuristic), quarterly stats (active client count, grade-improved/declined/same
counts via `getCoachImpactReport()` — `src/lib/coach/impact-report.ts`), notifications (unread
messages, pending invites), and quick links to every other page. Shows a "High-need specialist"
badge if the coach has the `comfort_with_high_need_candidates` tag and ≥2 clients.

### Caseload — `.../caseload/[token]/page.tsx`
Roster-level table: every client's week number, execution grade, and up/down/flat trend
(`getCoachCaseload()`, `src/lib/coach/caseload.ts`), with a banner calling out stalled clients by
name.

### Your clients — `.../clients/[token]/page.tsx`
Accordion list (`getCoachClientSummaries()`, `src/lib/coach/client-summary.ts`) — each row expands
to show targeting details, with links into **Pre-Session Brief** and **Full Client View**.

### Pre-Session Brief — `.../clients/[token]/[clientId]/page.tsx`
Built by `getPreSessionBrief()` (`src/lib/coach/pre-session-brief.ts`). Shows: current Market
Reality Grade + trend, this week's committed actions (done/not done), an avoidance-pattern callout
(candidate has committed to the same action type N weeks running without ever completing it),
last mood check-in, an AI-generated suggested opening question, last session's focus note, and
non-negotiables/biggest-worry pulled from the candidate's Coaching Onboarding Form answers. Ends
with a **Log this session** form (`LogSessionForm` → `logCoachSession` in
`clients/[token]/[clientId]/actions.ts`) capturing duration, notes, directives, and a focus note
for next time — writes a `CoachSession` row.

### Full Client View — `.../clients/[token]/[clientId]/full/page.tsx`
Built by `getFullClientView()` (`src/lib/coach/full-client-view.ts`). Everything from the brief
plus: full targeting, complete grade history (market + execution), work history, references, mood
history, and the complete session log (each session's notes/directives, with a
**"followed through" resolution** — `ResolveDirectiveForm` → `resolveSessionDirective` — lets the
coach mark a logged directive as actually completed by the candidate, tagging which scoring
category it applies to; this triggers `applyDirectiveResolvedRewrite()`
(`src/lib/scoring/rewrite-actions.ts`), treating a coach's direct observation as the strongest
available evidence for that scoring category).

The bottom of this page is **gated on candidate consent** (`coachDossierConsentedAt`) — until the
candidate explicitly shares their Executive Dossier and Coaching Notes, nothing below that point
renders. Once consented: full `DossierSectionsView` (read-only), `CoachingNotesPanel`, and a
read-only mirror of the candidate's own Jobs view (open postings + surfaced matches + a count of
A-List-exclusive listings still locked). Page copy explicitly notes this content is in-app only —
never downloadable, exportable, or forwardable from this surface.

### Session Impact Report — `src/lib/coach/session-impact.ts` (surfaced to the *candidate*, not a
standalone admin/coach page)
Worth documenting here since it's coach-session-adjacent: `getSessionImpactReport()` compares the
candidate's grade and completed-action count between their last two coaching sessions, detects any
still-present avoidance pattern, and asks Claude (`claude-sonnet-5`) to write a short warm summary.
`getUnviewedSessionImpact()` is the one-shot delivery mechanism — shown to the candidate once per
new session (7-day window), then stamped `viewedByCandidateAt` so it never repeats.

### Invite a client — `.../invite-client/page.tsx` + `actions.ts`
Session-based. Coach enters an email (+ optional name); `sendCoachClientInvite` creates a
`CoachClientInvite` row, generates a **pre-confirmed** Supabase invite link
(`createPreConfirmedInviteUser`, `src/lib/invite/invite-and-preconfirm.ts` — skips the normal
email-confirmation step), and emails it (`sendCoachClientInviteEmail`). The page also lists every
past invite with status (Joined / Invite pending / Already has an account — detected live via
`findExistingRegisteredAccount` in case the invitee signed up organically after the invite was
sent) and a **Resend** button. `finishAcceptingCoachInvite` (called from the auth callback handler
once the invited user has a session) sets `coachId` on their new `CandidateProfile` — this is a
**write-once** field; the code comments repeatedly stress the "never reassign coachId" invariant.

### Share invite link — `.../invite/[token]/page.tsx`
Token-based. A generic, always-valid link (`/api/coach-invite/[accessToken]`) anyone can sign up
through and land attributed to this coach — simpler than the by-email flow, no per-invite
tracking.

### Messages — `.../messages/page.tsx`, thread `.../messages/[threadId]/page.tsx`
Session-based. Uses the shared messaging module (section 9) — `getCoachThreads()`.

### Settings — `.../settings/page.tsx` (session entry point, redirects to
`.../settings/[token]/page.tsx`)
Branding (`CoachBrandingForm` — name/logo/accent color, used across all client-facing coach
surfaces), profile photo upload (separate from firm logo, shown in messaging), and the
**Coaching Onboarding Form editor** (`OnboardingTemplateEditor`,
`src/lib/coach/onboarding-form.ts`) — the self-serve questions a new client answers right after
granting dossier consent. Explicitly scoped to goal-setting/logistics only; sensitive topics stay
a live verbal conversation. Becomes the standing template applied to every new client.

---

## 3. Recruiter portal — `/recruiters`

For third-party recruiters/headhunters. **`/recruiters` (root, outside the `(app)` group) is the
public marketing/waitlist landing page** (`src/app/recruiters/page.tsx`, uses the shared
`OrganizationPageTemplate` + `WaitlistForm` — see section 10); the actual product lives under
`/recruiters/(app)/*`, `/recruiters/login`, `/recruiters/signup`. Session-based (Supabase auth,
`Recruiter.userId`), except the **Job Board submit/submissions** and **Search Calibration Memo**
pages, which are `accessToken`-gated like the coach portal's client-detail pages (same
pre-Supabase-auth wrinkle, per an inline code comment in `RecruiterNav`).

Layout: `src/app/recruiters/(app)/layout.tsx` → `getCurrentRecruiter()`
(`src/lib/recruiter/current-recruiter.ts`), renders `RecruiterNav` with unread-message and
not-yet-invited-candidate badge counts.

### Dashboard — `.../dashboard/page.tsx`
"Needs your attention" (candidates added to their book but not yet invited; any of their own Job
Board postings that got rejected, with the reason). At-a-glance stats: candidates sourced, invited,
signed up, pending Job Board postings. Quick links to every other page.

### Candidate Search — `.../search/page.tsx`, brief `.../search/[candidateId]/page.tsx`
Searches the opted-in candidate pool (`recruiterDatabaseOptIn: true`, privacy tier not
LOCKED/STEALTH, `assessmentComplete: true`) by function, level, remote policy, location, and comp
budget. Results ranked by `computeMatchScore()` (`src/lib/matching/compute-match-score.ts`).
**Identity is privacy-tiered**: `PUBLIC`-tier candidates show a real first-name + last-initial;
everyone else shows only a role/level description (`"Director Product Marketing professional"`)
until they self-reveal. Clicking through opens a **Candidate Brief**
(`generateHiringManagerReport()`, `src/lib/reports/hiring-manager-report.ts`) — red flags summary,
interview-audit focus areas, self-vs-reference friction examples (where the candidate's
self-description diverges from what references say), and a self-awareness score. Search only
surfaces candidates who've opted in *and* aren't privacy-locked, independent of grade (unlike the
Talent match inbox, which requires an A grade — see section 4).

### My Candidates — `.../candidates/page.tsx` + `actions.ts`
Recruiter's own sourced network — people from their book who aren't on NextChapter yet.
`AddSourcedCandidateForm` creates a `SourcedCandidate` row (name/email/notes). Per-candidate
**Invite** action (`inviteSourcedCandidate`) sends the same pre-confirmed-invite-link pattern used
by coach invites; if the person already has an account elsewhere, the row is stamped
`ALREADY_HAD_ACCOUNT` rather than silently failing. Once accepted (`finishAcceptingRecruiterSource`,
called from the auth callback), the new `CandidateProfile` gets `sourcingRecruiterId` set
(write-once, same invariant as `coachId`) and — per an explicit product decision documented
in-code — gets **no special treatment** beyond that recorded relationship: full onboarding,
general searchable pool, same as any organic signup.

### My Candidate Book — `.../candidates/book/page.tsx`
The curated subset of sourced candidates (`inBook: true`, toggled via `toggleInBook`) a recruiter
has selected to present to an employer, each with resume commentary (`updateResumeCommentary`) and
a signed resume URL (only ever generated once a `SourcedCandidate` has actually signed up —
`candidateId` set). Printable (`PrintReportButton`).

### Search Calibration Memo — `.../calibrate/[token]/page.tsx` + `actions.ts`,
history `.../calibrate/[token]/history/page.tsx`
Recruiter pastes a client brief; `generateCalibrationMemo` sends it to Claude
(`claude-sonnet-5`, adaptive thinking) with a prompt that flags redundant requirements, conflicting
asks, comp/level mismatches, and suggests adjacent candidate profiles worth considering — grounded
strictly in what's written, explicitly instructed **not** to estimate pool-size percentages (no
data access to support that). Every generated memo is persisted as a `CalibrationMemo` row for the
history page.

### Post to the Job Board / My Postings — `.../job-board/submit/[token]/page.tsx` +
`.../job-board/submissions/[token]/page.tsx`
Recruiter-side half of the shared NC Job Board submission pipeline — see section 5. Recruiters are
the **only** submitter type allowed `EXCLUDED` distribution and `CONFIDENTIAL` disclosure
(confidential retained-search listings that hide the company name from candidates).

### Messages — `.../messages/page.tsx`, thread `.../messages/[threadId]/page.tsx`
Shared messaging module — `getRecruiterThreads()`. A thread can only be created once a
`SourcedCandidate` for that recruiter/candidate pair has reached `status: SIGNED_UP` (enforced
server-side in `getOrCreateThread`, section 9).

### Settings — `.../settings/page.tsx` + `actions.ts`
Name, firm, specialty (`RecruiterSettingsForm`), profile photo (shown to candidates once they sign
up through this recruiter).

---

## 4. Employer / Hiring Manager portal — `/talent`

For companies hiring through NextChapter. **There is no marketing landing page at `/talent`
itself** — `/talent` is purely the authenticated product (`/talent/login`, `/talent/signup`,
`/talent/(app)/*`); the public pitch for this audience lives at `/employers` (see section 10).
Session-based throughout.

Layout: `src/app/talent/(app)/layout.tsx` → `getTalentDashboardData()`
(`src/lib/talent/get-talent-dashboard-data.ts`), renders `TalentNav`. Note: seat members (invited
teammates, not the account owner) resolve to the **same** `EmployerProfile` row via
`resolveEmployerForUserId`'s owner-or-seat fallback — most pages work identically for owner and
seat member; **Team** is the one page gated owner-only (see below).

### Home — `.../(app)/page.tsx`
"Needs your attention" (rejected Job Board postings, with reason). At-a-glance: active role count,
total pipeline interactions, in-conversation count, hired count, pending Job Board postings.

### Post a Role — `.../roles/new/page.tsx` + `actions.ts`
`RoleForm` creates a `RoleProfile` (title, function, level, location, remote policy, comp range).
Supports **JD extraction** — paste a full job description and `extractRoleFromJDAction` (Claude)
pre-fills the structured fields (`src/lib/roles/extract-role-from-jd.ts`); the resulting
`viaJdExtraction` flag is captured in the `role_posted` PostHog event.

### My Roles / role detail — `.../roles/page.tsx`, `.../roles/[id]/page.tsx`
List and per-role detail: candidate-interaction status breakdown (Viewed/Saved/Interest
expressed/Candidate revealed/In conversation/Hired/Passed), comp range, and a link into the
role's **Match Inbox**.

### Match Inbox — `.../roles/[id]/candidates/page.tsx`
Candidates matched to a specific role. Pool is `recruiterDatabaseOptIn: true` + valid privacy tier
+ `assessmentComplete: true`, **then filtered to only candidates currently holding an A grade**
(latest `hireabilityReports` snapshot) — this is stricter than recruiter Candidate Search, which
has no grade gate. Ranked by `computeMatchScore()` against the role's requirements, each card shows
an effort-summary line (learning badges + applications + outreach logged) via
`computeEffortSummaryLines()`.

### Candidate Inbox — `.../candidates/page.tsx`
Every `CandidateInteraction` this employer has ever had, across all roles, with status and which
role it was for.

### Candidate detail / Evidence Brief — `.../candidates/[id]/page.tsx` + `actions.ts`
The core hiring-manager artifact. `generateEvidenceBrief()` (`src/lib/reports/evidence-brief.ts`)
produces: work history + work samples ("what they've done," tagged `self_reported`), an
effort/motivation signal (tagged `verified_fact`), an optional "why they might fit" note (tagged
per its own evidence type via `EvidenceTypeBadge`), an uncertainty section (gaps + 3 questions
worth asking), and a next-step block. If the candidate hasn't yet approved revealing their full
identity to this employer, the brief renders anonymized (`brief.approvalPending`) and the
**Message candidate** button (`startMessagingCandidate` → `getOrCreateThread`) is hidden — messaging
is gated on the same `ApprovedEmployer` reveal record the brief's identity-reveal logic uses (see
section 9's thread-creation gates). Below the brief: **hiring outcome tracking** —
`markCandidateHired` stamps `hiredAt` and starts a 30/90/180-day check-in cadence
(`getDueOutcomeWindow`, `src/lib/talent/outcome-ratings.ts`); `submitOutcomeRating` records a 1–5
rating for whichever window is currently due, feeding Hiring Analytics.

### Saved Candidates — `.../saved/page.tsx`
`CandidateInteraction` rows with `status: SAVED`.

### Hiring Analytics (outcome loop) — `.../analytics/page.tsx`
`getHiringAnalytics()` (`src/lib/talent/hiring-analytics.ts`): total candidates engaged, hired
count, average time-to-hire in days, and a funnel-conversion bar chart across interaction statuses
(passed candidates counted separately, excluded from the funnel bars).

### Job Board (submit / submissions) — `.../job-board/submit/page.tsx` + `.../job-board/submissions/page.tsx`
Employer-side half of the shared submission pipeline (section 5) — session-based (unlike the
recruiter side's token-gated equivalent), no `EXCLUDED`/`CONFIDENTIAL` options.

### Team — `.../team/page.tsx` + `actions.ts`, accept flow `.../seats/accept/[token]/page.tsx`
**Owner-only** (redirects any non-owner, including accepted seat members, back to `/talent`).
`InviteSeatForm` creates an `EmployerSeat` invite; the accept page (token-based, no session
required to view) validates the invited email matches the logged-in/just-registered user before
granting access, then hands off to `AcceptSeatButton`/`AcceptSeatForm`. `revokeSeat` removes access
or cancels a pending invite.

### Messages — `.../messages/page.tsx`, thread `.../messages/[threadId]/page.tsx`
Shared messaging module — `getEmployerThreads()`. Thread creation gated on an `ApprovedEmployer`
row existing for the pair (the candidate-controlled reveal).

### Settings — `.../settings/page.tsx` + `actions.ts`
Company profile fields.

---

## 5. The NC Job Board submission system

One posting model (`ExclusiveJobPosting`) feeds four distinct submission paths, unified by two
shared library modules:

- **`src/lib/jobs/job-board-submission.ts`** — `validateJobBoardSubmission(input, source)` is the
  single **server-side** validation gate (never trust client-side form flags): title, company,
  real URL, posting type, salary band (min ≤ max) always required; named contact + contact email
  required for every source **except `admin`** (an admin has already personally vetted the
  listing); `EXCLUDED` distribution and `CONFIDENTIAL` disclosure are only valid for
  `source: 'recruiter'`, enforced here regardless of what the form UI allows client-side.
  `createPendingJobBoardPosting()` writes the row with `status: 'pending'` and a 30-day
  `expiresAt`. `reconfirmJobBoardPosting()` is the only path allowed to push `expiresAt` forward —
  a genuine "still open" re-confirmation, never a silent bump.

- **`src/lib/jobs/ats-job-board-feed.ts`** — `runAtsJobBoardFeed()`, run nightly by
  `/api/cron/ats-job-board-feed` (10:30 UTC daily per `vercel.json`). Pulls live listings directly
  from each company's own ATS-hosted board — **Greenhouse** (`boards-api.greenhouse.io`), **Lever**
  (`api.lever.co`), and **Ashby** (`api.ashbyhq.com`) — for every company in
  `ATS_COMPANIES` (`src/lib/market/ats-companies.ts`), fetched concurrently. Every listing that
  clears the bar lands directly as `status: 'approved'`, `source: 'ats_feed'`, `contactName: null`
  — **no admin review**, because unlike a self-submission there's no identity to verify (it's
  pulled straight from the company's own live careers page). Because there's no human trust check
  here, the fit bar is stricter than the admin queue's blended score: a listing is only admitted if
  it (a) is a US location (`isUsLocation`), (b) confidently maps to a function via
  `inferFunctionFromTitle` (deliberately conservative), and (c) at least one real candidate in the
  pool shares that function with a seniority within one level band
  (`levelDistance(candidate.level, inferredLevel) <= 1`). Salary parsing differs per provider —
  Greenhouse doesn't expose salary in the bulk feed at all (would need a second
  `?pay_transparency=true` fetch per job); Ashby's free-text `compensationTierSummary` is parsed
  with a regex (`parseSalaryRange`). Re-seen URLs get reconfirmed (`expiresAt` pushed forward)
  rather than duplicated.

Submission entry points:
| Source | Page | Token/session | Extra capabilities |
|---|---|---|---|
| Admin | `/support/admin/exclusive-jobs` | session (`requireAdmin`) | Autofill-from-URL, saves straight to `approved` |
| Employer | `/talent/job-board/submit` | session | none extra |
| Recruiter | `/recruiters/job-board/submit/[token]` | accessToken | `EXCLUDED` distribution, `CONFIDENTIAL` disclosure |
| ATS feed | cron only, no UI | n/a | auto-approved, algorithmic fit gate |

Every non-admin, non-ATS submission lands `pending` and must clear the admin review queue
(section 1, "Job Board") before any candidate ever sees it.

Expiry: `/api/cron/expire-job-postings` runs daily (10:00 UTC) to sweep past-due postings (30 days
after approval/last confirmation) off the active board.

---

## 6. Employer Reference & Referral feature (Prompt 65)

Lets a manager who just laid someone off (or otherwise parted ways) leave that person a real
reference **before** they even have a NextChapter account — reframing an awkward moment into
something concrete. Files: `src/lib/employer-references/submission.ts`,
`src/app/for-managers/give-a-reference/*`.

- **Landing page** — `for-managers/give-a-reference/page.tsx`. Public marketing page ("You just let
  someone great go. Help them land well."), explains the flow in three steps, CTA into the form.
- **Submission form** — `for-managers/give-a-reference/submit/page.tsx` +
  `EmployerReferenceForm.tsx` + `actions.ts`. `validateEmployerRegistration()` mirrors the Job
  Board's trust-gate philosophy: no domain verification exists, so a named, real-looking submitter
  (name, company, work email) is the gate instead of a technical check. The reference content
  itself (ratings, strengths, growth areas, story fields, traits) is parsed by the shared
  `parseReferenceFormData()` (`src/lib/references/parse-reference-form.ts` — shared with the
  candidate-facing reference request flow).
  `submitEmployerReference` creates an **`EmployerReferenceSubmission`** row — explicitly **not** a
  `Reference` row. Nothing here is queryable by the Dossier, Coaching Notes, or anywhere else in
  the app until the invited employee explicitly **claims** it (`/claim-reference/[token]`, part of
  the candidate-facing surface, out of scope for this doc but the consent boundary is enforced at
  the model level: a pending `EmployerReferenceSubmission` simply isn't joined into anything until
  claimed). An invite email (`EmployerReferenceInviteEmail`, via Resend) is sent to the departing
  employee with a claim link.
  A **layoff-context path**: if the submitter marks `isLayoffContext: yes`, this triggers *both* an
  immediate founder-notification email (`sendLayoffContextAlertEmail`) *and* an
  `attioSyncRequestedAt` marker — a single "yes" checkbox drives both outcomes. There's no live
  Attio API integration wired up yet (no client/credentials in this codebase); the marker exists so
  a real sync can be built later — see the CRM sync gap in NextChapter's deferred-follow-ups
  memory. `founderNotifiedAt` records whether the alert email actually sent.
- **Thank-you page** — `for-managers/give-a-reference/thank-you/page.tsx`.
- **Admin visibility** — `/support/admin/employer-references` (section 1) and the candidate's own
  pending-claim view are the *only* two places a pending submission is visible before it's claimed.

---

## 7. Market Pulse

Ingests external articles/links, classifies them, and routes them to the right internal consumer.
Core pipeline: `src/lib/research/ingest.ts` — `ingestResearchUrl(url, source)`:
1. `fetchArticle()` (`src/lib/research/fetch-article.ts`) fetches and extracts readable text.
2. If the fetch fails, a `ResearchLibraryItem` row is still created (`fetchFailed: true,
   needsReview: true`) — the ingestion pipeline **never silently drops a URL**.
3. On success, `classifyResearchItem()` (`src/lib/research/classify.ts`) buckets it into one of
   five categories — `GUIDE_SEO`, `MARKET_BRIEF`, `PRODUCT_POSITIONING`, `PR_MEDIA_HOOK`,
   `PERSONA_RESEARCH` — with a confidence score, credibility tier (`recognized`/`unknown`),
   suggested action, a `contradictsLockedDecision` flag, and a persona tag.
4. **`PR_MEDIA_HOOK`** items trigger an immediate alert email (`sendPrHookAlertEmail`) at
   classification time — high-priority, not queued for a weekly cycle.
5. If classification itself throws, the row still persists with the fetched text but no
   bucket/summary, flagged `needsReview: true`.

Two ingestion sources:
- **Manual** — the admin Market Pulse page's quick-add form (`addResearchItem` action).
- **Inbox** — Gmail OAuth sweep. `src/lib/google/connection.ts` (`getActiveGoogleConnection`,
  `getValidAccessToken`) and `src/lib/google/gmail.ts` (`listAlertMessages`, `getMessageHtml`,
  `extractAlertUrls`, `markMessageRead`) drive `/api/cron/research-inbox-sweep` (daily, 12:00 UTC,
  `maxDuration: 120`): lists unread Google Alert-style messages in the connected inbox, extracts
  URLs from each, ingests any not already in the library, marks the message read, and stamps
  `GoogleInboxConnection.lastSweepAt`. Connect/disconnect happens from the admin Research page
  (`/api/google/oauth/start`, `disconnectGoogleInbox` action) — `getResearchLibraryAlertEmail()`
  (`src/lib/admin/auth.ts`) names the alert recipient (a dedicated env var, or the first
  allowlisted admin as fallback).

Admin triage (`/support/admin/research`, section 1) is where items get reviewed, queued for the
Weekly Market Digest (`MARKET_BRIEF` bucket → `toggleQueuedForDigest`), or flagged to the product-
positioning copy owner (`PRODUCT_POSITIONING` bucket → emails via
`sendProductPositioningFlagEmail`). Candidate-facing surfacing of research content (Market Brief
copy, guide content) is outside this doc's scope (candidate-facing side is covered by a separate
agent) but is sourced from the same `ResearchLibraryItem` table.

---

## 8. Weekly digest emails

Four audiences, four separate crons, all authenticated by comparing the `Authorization: Bearer`
header against `process.env.CRON_SECRET`, all on Tuesdays (`vercel.json`):

| Cron | Time (UTC) | Audience filter | Content |
|---|---|---|---|
| `market-digest-candidates` | 14:00 | — (candidate-facing, out of scope) | — |
| `market-digest-coaches` | 14:30 | `Coach` where `marketDigestOptedOut: false` | Up to 3 unique target-role lines aggregated across the coach's whole caseload (never an individual client's identity/score — code comment stresses this is aggregate-only), each enriched with live Adzuna market-condition counts (`getMarketConditions`), plus a shared `PERSONA_RESEARCH` nugget from the Market Pulse queue |
| `market-digest-recruiters` | 15:00 | `Recruiter` where `marketDigestOptedOut: false` | Market conditions for the recruiter's own `specialty`, plus a shared `MARKET_BRIEF` nugget |
| `market-digest-employers` | 15:30 | `EmployerProfile` where `marketDigestOptedOut: false` | Up to 3 unique active-role lines with market conditions, plus a shared `MARKET_BRIEF` nugget |

Shared plumbing: `src/lib/admin/digest-composer.ts` — `getDigestNugget(bucket)` pulls the
most-recently-queued `ResearchLibraryItem` in the given bucket (reused identically across every
recipient in that send, since it's non-personalized), and `recordDigestSend(audience,
recipientCount, itemIds)` writes a `DigestSend` row consumed by the admin Digest page's send
history. Each cron's actual email template lives in `src/lib/email/send-market-digest-{coach,
recruiter,employer}.ts`. A recipient with nothing to say (no roles/specialty and no nugget) is
skipped entirely for that run.

---

## 9. Messaging system

One shared module, `src/lib/messaging/threads.ts`, is the **only** place allowed to query
`CandidateProfile` for thread/inbox display purposes — deliberately restricted to display-only
fields (`firstName`, `lastName`, `profilePictureUrl`, `profilePictureVisible`; never
`hireabilityReports`, assessment responses, email, or phone), enforced even inside the coach
portal where dossier access is a separate, already-consent-gated surface that messaging must not
become a side channel around.

`MessageThread` has one candidate side and a polymorphic partner side (`partnerType`: `COACH` /
`RECRUITER` / `EMPLOYER`, resolved to `coachId`/`recruiterId`/`employerId`).

**Thread creation gates** (`assertThreadAllowed`, enforced server-side in `getOrCreateThread` —
not just at UI call sites, since this is the single real creation path):
- **Coach** — any coach whose `id` matches the candidate's own `coachId` may message. No extra
  gate; it mirrors the existing coach-client relationship.
- **Recruiter** — only once a `SourcedCandidate` row for that recruiter/candidate pair has
  `status: SIGNED_UP` (never before signup — an "ADDED" or merely-"INVITED" lead can't be messaged).
- **Employer** — only once an `ApprovedEmployer` row exists for the pair — the candidate-controlled
  identity-reveal gate (set via `approveEmployerInterest`, candidate-facing). Messaging must never
  become a way to reach a candidate who hasn't approved being revealed.

`sendMessage(threadId, senderRole, body)` writes the `Message` row and bumps `lastMessageAt` +
the sender's own `*LastReadAt` timestamp in one transaction, then fires an email notification
(`notifyNewMessage` — resolves the recipient's auth email, builds a role-appropriate deep link back
into their own portal's thread view, and sends via `sendNewMessageNotification`; **never** includes
the message body itself, and a notification failure never blocks the send). Unread state is
computed client-side-cheap: `lastMessageAt > {candidate,partner}LastReadAt` — no dedicated
"unread" column, and unread counts across many threads are computed in JS (Prisma can't compare
two columns on the same row in a single WHERE).

Per-portal wrappers: `getCandidateThreads`/`getCandidateUnreadCount`,
`getCoachThreads`/`getCoachUnreadCount`, `getRecruiterThreads`/`getRecruiterUnreadCount`,
`getEmployerThreads`/`getEmployerUnreadCount`, plus a shared `getThreadWithMessages(threadId)` used
by every thread-detail page regardless of side (the caller is responsible for its own ownership
check before calling it).

---

## 10. Org/marketing landing pages

Six of these seven share one component, **`OrganizationPageTemplate`**
(`src/components/organizations/OrganizationPageTemplate.tsx`), driven by a per-audience config in
**`AUDIENCE_TABS`** (`src/components/audience/audience-data.ts`). Each tab defines its own field
set for a client-side **`WaitlistForm`** (`src/components/audience/WaitlistForm.tsx`), which
`POST`s to **`/api/waitlist`** (`src/app/api/waitlist/route.ts`) → `prisma.waitlistSignup.create({
audience, payload })` — a real, if minimal, backend write (`WaitlistSignup` model), not just a
PostHog event. (If `NEXT_PUBLIC_WAITLIST_ENDPOINT` is unset the form still shows a confirmation
even without a network call — "demo mode.") A hidden honeypot field (`_gotcha`) silently drops bot
submissions.

- **`/for-organizations`** — umbrella page introducing all the org-facing audiences at once
  ("whether you hire, recruit, place, fund, or serve jobseekers..."); links out to each
  audience-specific page below.
- **`/employers`** — pitch to hiring managers: "Hire for Fit, Not Keywords" — verified profiles +
  How-They-Work-Best insight, flat monthly price, no per-hire fees. Uses the `employers` audience
  tab. (The real product for this audience is `/talent`, reached after joining the waitlist /
  being onboarded — no direct self-serve signup link from this marketing page in what was read.)
- **`/recruiters`** (root, distinct from `/recruiters/(app)/*`) — "Source Verified, Opted-In
  Talent" — pitches a pool that wants to be found, including candidates ATS keyword filters bury,
  without five-figure seat licenses. Uses the `recruiters` audience tab.
- **`/coaching`** — candidate-facing premium-coaching upsell/waitlist page (has its own
  `actions.ts`, not the shared template): `joinCoachingWaitlist` writes to a **different** model,
  `CoachingWaitlist` (candidate-linked if logged in), not `WaitlistSignup` — this is the one
  "waitlist" page that isn't part of the shared org-audience system, since its audience is
  candidates wanting a coach, not an organization.
  Note: this is arguably candidate-facing, included here because it lives outside `src/app/dashboard`.
- **`/coach-platform`** — "The White-Label Coach Platform" — pitches coaching *firms* on
  white-labeling the coach-portal tools (branding, full client view, session notes/directives)
  under their own name. Custom page (not the shared template) but reuses `WaitlistForm` directly.
- **`/outplacement`** — pitches HR/outplacement buyers: a real diagnostic + personalized plan +
  direct employer matches, positioned against "stale course library" competitors; protects employer
  brand, reports real outcomes. Uses the `outplacement` audience tab.
- **`/government-workforce`** — pitches WIOA/workforce agencies: free to every jobseeker, with the
  placement data agencies need for their own reporting. Uses the `government` audience tab.
- **`/nonprofits`** — pitches nonprofits/academia: free service to their community + consent-based
  research partnerships (grants, pilots, co-design). Uses the `nonprofits` audience tab.
- **`/for-coaches`** — pitches independent coaches on bringing their existing clients onto
  NextChapter for free (Market Reality Grade, action plan, daily accountability between sessions).
  Uses the `for-coaches` audience tab — note this is a *waitlist* entry point distinct from the
  coach portal's own real signup flow at `/support/coach/signup`.

None of these seven pages have any admin-side review queue of their own — `WaitlistSignup` rows
are not currently surfaced anywhere in the admin portal (no `/support/admin/waitlist` page exists
today; the closest matches investigated were the Requests and Coaching-related admin pages, neither
of which reads `WaitlistSignup`).

---

## Appendix — key Prisma models referenced throughout

`CandidateProfile`, `Coach`, `CoachSession`, `CoachClientInvite`, `Recruiter`, `SourcedCandidate`,
`CalibrationMemo`, `EmployerProfile`, `EmployerSeat`, `RoleProfile`, `CandidateInteraction`,
`ApprovedEmployer`, `ExclusiveJobPosting`, `JobBoardIntroRequest`, `BountyClaim`, `Reference`,
`EmployerReferenceSubmission`, `ResearchLibraryItem`, `DigestSend`, `GoogleInboxConnection`,
`WaitlistSignup`, `CoachingWaitlist`, `LayoffCohort`, `DashboardMessage`, `WeeklyBadgeEarned`,
`HireabilityReport`, `MessageThread`, `Message`. Full definitions: `prisma/schema.prisma`.
