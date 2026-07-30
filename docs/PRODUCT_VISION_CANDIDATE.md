# NextChapter — Candidate Side: Product & Systems Reference

Zero-context handoff doc for everything a *candidate* (job seeker) can see and do in NextChapter — onboarding, the grading/points/badges game mechanics, every dashboard feature page, Victoria (the AI coach persona), and every candidate-facing email. Companion doc (not covered here) handles admin/coach/recruiter/employer portals.

Stack: Next.js App Router + Prisma + Supabase (auth + storage). All file paths below are relative to the repo root (`/Users/salitkulla/nextchapter`).

Scope of this doc: `src/app/onboarding`, `src/app/dashboard`, `src/app/auth`, `src/app/claim-reference`, `src/app/ref`, `src/app/refer`, `src/app/share`, `src/app/submit-resume`, `src/app/start`, plus every `src/lib/*` module those pages depend on.

---

## 1. Onboarding flow

Entry points into onboarding:
- Marketing/persona landing pages at `/start/[persona]` (`src/app/start/[persona]/page.tsx`, personas defined in `src/lib/constants/personas.ts`) — pre-fill the "situation" answer via `SITUATION_TO_JOB_STATUS` so the first onboarding question is skipped.
- Direct resume drop at `/onboarding/resume`.
- The homepage's own situational entry cards (not covered here).

### 1.1 Step order and gating

`src/app/onboarding/page.tsx` is the **hub/router** — it's not a real page, it just redirects to whichever step is next, in this exact order:

1. `resumeStepComplete` → `/onboarding/resume`
2. `desireComplete` → `/onboarding/desire`
3. `part1Complete` → `/onboarding/circumstances`
4. `part3Complete` → `/onboarding/experience`
5. `part4Complete` → `/onboarding/goals`
6. `contractAcceptedAt` → `/onboarding/contract`
7. if `coachId` is set and `coachDossierConsentedAt` is null → `/onboarding/coach-consent`
8. if `coachId` set, consent given, but no Coaching Onboarding Form response yet → `/onboarding/coaching-form`
9. `registrationCompletedAt` → `/onboarding/score`
10. `introCommittedAt` → `/onboarding/welcome`
11. otherwise → `/dashboard`

**Important:** `part2Complete` (the How I Work Best / Working Style assessment) is **deliberately not in this mandatory chain**. A code comment in `src/app/onboarding/actions.ts` (`updateAssessment`) explicitly says it's "no longer part of the mandatory onboarding chain — reachable any time as an optional dashboard action-plan item." It's reachable from `/onboarding/working-style` or later from `/dashboard/retake-assessment`, and it's one of the Weekly Search Sprint's suggested actions (`WORKING_STYLE_QUIZ`, unshifted to the front of the suggestion list whenever incomplete — see `src/lib/weekly/sprint.ts`).

The actual gate logic lives twice: the hub above, and `getDashboardData()` (`src/lib/dashboard/get-dashboard-data.ts`) — **this second one is the authoritative gate for reaching `/dashboard` itself**:

```
no profile / !assessmentComplete       → redirect /onboarding
!registrationCompletedAt (after sync)  → redirect /onboarding/create-account
!introCommittedAt                      → redirect /onboarding/welcome
```

### 1.2 Step-by-step content

| Step | Route | What's collected | Prisma writes |
|---|---|---|---|
| Resume upload | `/onboarding/resume` (`src/app/onboarding/resume/page.tsx`) | Resume file — auto-extracts name/contact/experience to prefill the rest of onboarding | `Resume` row; `CandidateProfile.resumeStepComplete` |
| Desire/situation | `/onboarding/desire` | Which situation best describes them (worried about layoff, just resigned, just laid off, reentering workforce, career pivot) | `CandidateProfile.currentJobStatus`, `desireComplete` |
| Circumstances | `/onboarding/circumstances` | Detailed job status, gap duration bucket, job-search difficulty (1-4), biggest barriers (multi-select, deliberately excludes "Network" as an option), search intensity, plus **optional** self-report fields: jobs applied bucket, interviews received, networking level, learned-new-skills level, tried part-time/consulting, tried executive coaching, connected with recruiters | `CandidateProfile` fields; `part1Complete` |
| How I Work Best assessment | `/onboarding/working-style` (optional, not gated) | A quad-block (ipsative, "most/least like me") + Likert-item assessment | `CandidateAssessmentResponse`, `AssessmentResult`; `part2Complete` |
| Experience | `/onboarding/experience` | People-manager status + team size, top strengths (multi-select), several 1-100 confidence sliders (function skill, AI flexibility, management skill, action-oriented, creativity, communicator) | `CandidateProfile` fields; `part3Complete` |
| Goals | `/onboarding/goals` | Target role/industries/function/company size/stage, primary function, remote preference, comp flexibility, willing-to-start-lower + rationale, pivoting flag, relocation + notes, deal breakers, public disclosure comfort, referral history, and a **ranked** trade-off priority list | `CandidateProfile` fields; `part4Complete`, `assessmentComplete = true`, `assessmentCompletedAt` |
| Contract | `/onboarding/contract` | Accept/decline the "commitment" + choose a notification tier (MINIMAL / ESSENTIALS / FULL) + optional SMS opt-in | `contractAccepted`, `contractAcceptedAt`, `notificationTier`, `smsPhone`/`smsConsentedAt` (only if tier is FULL and opted in) |
| Coach consent (only if pre-assigned a coach via invite link) | `/onboarding/coach-consent` | Explicit, separate consent to let a coach see the Executive Dossier/Coaching Notes | `coachDossierConsentedAt` — **the only place this is ever set to non-null during onboarding** |
| Coaching Onboarding Form (only if coach + consent) | `/onboarding/coaching-form` | Coach-defined custom questionnaire | Feeds Coaching Notes / Pre-Session Brief only — never the external Executive Dossier |
| Score reveal | `/onboarding/score` | Nothing collected — shows the initial Market Reality Grade (`computeHireabilityGrade`), narrated by **Victoria** | none |
| Create account | `/onboarding/create-account` | Sets password, sends confirmation email | Converts the anonymous Supabase session to a real one |
| Welcome | `/onboarding/welcome` | Final commitment click | `introCommittedAt`; auto-populates the candidate's first Weekly Search Sprint |

### 1.3 The Hireability Assessment / score reveal

`/onboarding/score` (`src/app/onboarding/score/page.tsx`) computes the grade live via `computeHireabilityGrade()` and renders it with `<GradeReveal>`, narrated in first person by Victoria ("Your initial grade is based on what you've told me..."). This happens **before** an account exists (the Supabase session is still anonymous) — the CTA is "Create your account to get your full report and action plan."

### 1.4 Account creation / email confirmation flow

NextChapter starts every candidate as an **anonymous Supabase session** the moment they upload a resume (see `ResumeUploadForm`'s `uploadResume` action, which lazily creates the session). Nothing is "real" until email confirmation:

1. `/onboarding/create-account` (`src/app/onboarding/create-account/page.tsx`) — requires `assessmentComplete`. Renders `<CreateAccountForm>`, which calls Supabase's email-confirmation flow (`next=secure-account` in the callback URL) and sends a confirmation email.
2. Candidate clicks the emailed link → lands on `/auth/callback` → `<CallbackHandler>` (`src/components/auth/CallbackHandler.tsx`).
   - The token is **not consumed on page load** — only on an explicit "Continue" click — specifically to survive corporate email-security link-prefetching, which would otherwise burn a single-use token before the human ever clicks.
   - For a candidate (as opposed to employer/recruiter/coach signup, which share this same handler), the relevant path is `next=secure-account`: after `verifyOtp`, status becomes `secure-account` and `<SecureAccountForm>` is shown to set a real password.
3. Setting the password completes the transition. `syncRegistrationCompletion()` (`src/lib/onboarding/sync-registration.ts`) is what actually flips `registrationCompletedAt` — it runs opportunistically **every time a profile is fetched for an authenticated request**, checking `user.is_anonymous`. It also:
   - Stamps `passwordSetAt` if the identity came from Google OAuth (since that flow never goes through the password form).
   - Blocks registration and sets `duplicateEmailBlockedAt` if the now-confirmed email already belongs to another registered `CandidateProfile` — surfaces `<ExistingAccountNotice>` telling them to log into their existing account instead.
   - Returns `justRegistered: true` exactly once, on the transition — `getDashboardData()` uses this to trigger, via `after()` (non-blocking, doesn't hold up the page), the **first Hireability Report generation and its email**, guarded by `claimReportGeneration()` (`src/lib/reports/report-generation-lock.ts`) so two near-simultaneous loads don't both generate it.
4. `mailer_autoconfirm=false` is set in Supabase — a fresh `signUp()` genuinely has no session until the email is confirmed; there is no shortcut around this flow (see the user's own memory note on this).

### 1.5 Welcome / intro commitment

`/onboarding/welcome` → `submitIntroCommitment()` (`src/app/onboarding/actions.ts`) sets `introCommittedAt` and calls `autoPopulateFirstSprint()` (`src/lib/weekly/sprint.ts`) so the candidate's dashboard never shows a genuinely empty first Weekly Search Sprint. This bonus is where `INTRO_WELCOME_BONUS_POINTS` (5 points) come from.

---

## 2. Grading system — `src/lib/scoring/`

### 2.1 One grade, six categories (Scoring Model 2.0)

There is exactly **one** letter grade shown to candidates: the **Market Reality Grade**. There used to be a second "Search Action Grade" — that's gone; weekly effort is now folded in as a bounded *input* to the one grade, not a second grade. This is documented at length in `src/lib/scoring/grade.ts` and `src/lib/scoring/hireability-grade.ts`.

The six categories (`CategoryKey` in `src/lib/scoring/grade.ts`):

| Category | What it's built from |
|---|---|
| **Target Fit** | Real market hiring demand (Adzuna listing counts + BLS YoY trend) + how well-matched/focused the stated target is + experience match (self-report heuristic blended 50/50 with the resume's own `experienceScore` once a resume exists) |
| **Leadership & Management** | `isPeopleManager` + `teamSizeManaged` + `managementSkillConfidence` self-report, blended with reference `traitPresenceRating` |
| **Skills & Execution** | `functionSkillConfidence` self-report, blended with reference `overallRating` |
| **Communication & Collaboration** | `communicatorConfidence` self-report blended with resume `atsScore`+`resultsScore` (readability/quantified-results), then blended with reference `traitCollaborationRating` |
| **Adaptability & Change Readiness** | Flexibility count (`willingToStartLower`, `compFlexible`, `openToRelocation`) + pivoting flag, blended with reference `traitAdaptabilityRating` |
| **Ownership & Reliability** | Almost entirely `traitFollowThroughRating` from completed references (there's no good self-report proxy for "can you be trusted without supervision") — defaults to 55 if no reference exists yet |

Each category also carries a **Confidence** level (`HIGH` / `BUILDING` / `PROVISIONAL`) — separate from the grade itself, describing how much real (vs. self-reported) signal backs it. Most categories go `HIGH` once ≥1 completed reference exists.

**Important scoring nuance:** the live-computed category score is *not* what's graded directly. There's a persisted per-category **baseline** (`CandidateProfile.categoryBaselineScores`, JSON) that only moves in two ways:
1. A bounded weekly nudge (see §2.3 below).
2. A discrete "rewrite" event — see §2.4.

### 2.2 Grade thresholds and philosophy ("hard graders")

`src/lib/scoring/grade.ts`, `scoreToGrade()`:

```
score >= 90 → A
score >= 75 → B
score >= 40 → C
score >= 20 → D
else        → F
```

The code comments are explicit and worth quoting directly: grading is **"deliberately hard"** — "most candidates should land on C, with A and F reserved for real extremes... this is a first-pass curve, not fit to real usage data." `GRADE_BAND_DESCRIPTION` reinforces this in the candidate-facing copy: "Most candidates land here [C]... that's the honest, expected result, not a failure." Raw numeric scores are **never shown to candidates anywhere** ("a number like '62/100' reads as more precise than the underlying signals actually are") — only the letter grade + band description.

Grade colors (`GRADE_TEXT_COLOR` / `GRADE_RING_STROKE`): A = success/green, B = brand, C = warning, D/F = error/red.

### 2.3 Weekly effort as a bounded, non-compounding nudge

Four "engines" (`WeeklyEngineKey`): **Learning**, **Effort** (interview prep + one-time setup confirmations — not shown as its own dashboard tile), **Working** (real assets — resume on file, work samples, active LinkedIn posting), **Connecting** (candidate-facing label: "Networking" — outreach, references requested, community engagement).

Each week, `computeWeeklyEngines()` (`src/lib/scoring/hireability-grade.ts`) sums the points of completed committed actions per engine against a proportional quarter of that week's points target (see §4 for the point table and target ramp).

The blend (`blendCategoryScore()`):
```
nudge = clamp(-15, +15, (weeklyPerformanceRatio - 0.5) * 30)
categoryScore = clamp(baseline + nudge)
```
A perfect week moves the grade up to 15 points; a dead week moves it down up to 15; hitting exactly 50% of the weekly target leaves the baseline untouched. **This nudge applies uniformly to every category's baseline** (not per-category effort) — categories keep separate baselines but move together with the week's overall effort level.

### 2.4 The A-grade gates

There are **two concrete, code-enforced places** that require a live `A` grade (`getCurrentGrade()` in `src/lib/scoring/hireability-grade.ts`):

1. **Offer Bonus / "Got Hired" bounty claim** — `submitBountyClaim()` (`src/app/dashboard/got-hired/actions.ts`) hard-blocks submission unless `getCurrentGrade(profile.id) === 'A'` this week.
2. **A-List-only Exclusive Job Board listings** — `/dashboard/find-my-job/page.tsx` computes `isAList = grade.grade === 'A'` and filters `ExclusiveJobPosting.audienceTier === 'A_LIST_ONLY'` listings out for anyone not currently graded A.

There is also a **week-4+ category-minimum floor**: from `CATEGORY_MINIMUM_ENFORCED_FROM_WEEK = 4` onward, none of the four weekly engines can score below `CATEGORY_MINIMUM_SCORE_FLOOR = 50` (grade C) — if any engine is below that floor, `categoryMinimumsMet = false` and **an A grade is force-capped down to B** (`overallScore = min(overallScore, 89)`), even if the raw category average would round to A. Below week 4, one strong engine can still carry the week (no time yet to build all four out). This is candidate-visible copy: "This week is capped at B — an A now requires real work across Networking, Learning, and Working, not just one."

**Naming collision to be aware of:** "A-List" is used for **three different, unrelated things** in this codebase:
- The grade-based gate above (current week's overall grade === A) — governs job-board visibility.
- The `WEEKLY_SCORE_A_LIST` weekly badge (hitting the weekly points target — see §3) — this is the actual, currently-written "A-List membership" record (`WeeklyBadgeEarned` table).
- `unlock-tier.ts`'s Tier 5 "A-List eligibility highlight" — a separate, activity-based tier (30-day streak + 5 LinkedIn logs + 2 completed references), nothing to do with the grade.

### 2.5 Rewrite actions — real events that move the baseline directly

`src/lib/scoring/rewrite-actions.ts` — the mechanism by which a discrete, high-signal real-world event (not gradual weekly effort) bumps a category baseline immediately:

| Event | Category bumped | Amount |
|---|---|---|
| Interview landed | Target Fit | +8 |
| Offer received | Target Fit | +15 |
| 2nd distinct interview (pattern confirmed) | Target Fit | +10 (fires once, only on the 1→2 crossing) |
| Reference completed | Leadership/Skills/Communication/Adaptability/Ownership (mapped per BARS field) | up to +12, only if the rating is strong (≥4/5) or rebuts a weak (<70) baseline |
| Work history logged during a gap (non-full-time engagement) | Target Fit | +6 |
| Learning completed that addresses a self-identified "skills_gap" barrier | Skills & Execution | +8 |
| Work sample uploaded | Skills & Execution | +5 |
| Resume re-upload with a meaningful (≥15pt) score improvement | Communication (presentation) and/or Target Fit (experience) | +6 each |
| Coach marks a directive resolved | whichever category the coach specified | +10 |

### 2.6 Report generation — see §6 (Hireability Report) for the full LLM prompt/gate logic.

---

## 3. Points, badges, unlock tiers

### 3.1 Community unlock tiers — `src/lib/community/unlock-tier.ts`

Five tiers (`Tier 1: Getting Started` → `Tier 5: Unstoppable`), computed from `UnlockTierSignals` (confirmed onboarding steps + completed sprint actions + check-ins, references, work samples, LinkedIn activity, streak, current-week sprint presence). **As currently coded, only Tier 5 actually unlocks a real, live feature** ("A-List eligibility highlight") — Tiers 2-4's descriptions explicitly say "Nothing new yet — future features will unlock here"; Community itself is open to everyone regardless of tier.

```
Tier 5: 30-day streak AND ≥5 LinkedIn logs AND ≥2 completed references
Tier 4: ≥20 total actions AND ≥1 LinkedIn log AND ≥3 references AND has a current-week sprint
Tier 3: ≥10 total actions AND ≥2 references AND ≥1 work sample
Tier 2: ≥5 total actions AND ≥1 reference
Tier 1: everyone else
```

### 3.2 Badges — three distinct systems, all computed live (not stored, except where noted)

**Phase-1 activity badges** (`src/lib/community/badges.ts`, `BadgeKey`) — legacy/simple: First Reference, First Work Sample, First Community Post, 7-Day Streak, 30-Day Streak, Made the A-List.

**Weekly badges** (`src/lib/badges/weekly-badges.ts`, `WeeklyBadgeKey`) — reset every calendar week, recomputed live on every call:
- `WEEKLY_SCORE_A_LIST` — this week's points hit the A target (see §4 ramp)
- `TEAM_PLAYER` — ≥3 "give" actions (encouragement notes sent + `ENGAGE_PEER_SUPPORT` completions)
- `WEEKLY_LEARNING` — ≥1 Learning engine action
- `WEEKLY_NETWORKING` — ≥3 outreach touches
- `DETAIL_ORIENTED` — every one-time (non-recurring) committed action this week got done
- `FULL_SPRINT` — everything committed to (one-time and recurring) got done
- `HIGH_FIT_APPLICATIONS` — 3-5 applications this week with real tailored resume bullets (capped at 5, no over-delivering bonus)

Any badge earned is upserted into `WeeklyBadgeEarned` — **this is the only place any weekly badge, including the real A-List membership record, is actually persisted.**

**Milestone badges** (`src/lib/badges/milestone-badges.ts`, `MilestoneBadgeKey`) — earned once, permanent: 7/30/90-Day Streak, Comeback (returned after a >7-day gap), Over-Delivering Streak (≥2 consecutive weeks beating target), Landed an Interim Role, Dossier Complete, Reference Champion (every requested reference completed), AI Fluent, Gap Closer (a named Market Reality gap that later disappeared — can be earned multiple times, once per distinct closed gap).

### 3.3 Points and where they're awarded — `src/lib/weekly/action-effort.ts`

**1 point = 1 minute of effort**, fixed per action type (not estimated/judgment-weighted). Full point table spans Outreach, Engage (Support Network), Thought Leadership, Learning, Resume/Assets, Interview Prep, and one-time onboarding confirmations. Examples: `OUTREACH_MESSAGE` 15pts, `LEARNING_CERTIFICATE` 40pts, `RESUME_UPDATE` 30pts, `PROFILE_CONFIRM` 5pts. `ENGAGE_PEER_SUPPORT` is **deliberately 0 points** — "once a behavior earns points its frequency stops being clean evidence someone would do it without incentive."

Recurring vs. one-time: recurring action types (outreach, engage, thought-leadership comments, etc.) get a one-way "Started" toggle (no un-checking); one-time actions get a real Mark-done toggle.

**Verified actions**: a subset (profile/industry/function/salary confirmations, working-style quiz, optional-questions) are reconciled against real backing data server-side (`reconcileVerifiedActions`, `src/lib/weekly/action-verification.ts`) rather than trusted as a self-report click — "ungameable."

**Weekly points target ramp** (`pointsNeededForA`): `[60, 75, 90, 105, 120]` for weeks 1-5, then holds flat at 120. Sub-A bands: B ≥75%, C ≥50%, D ≥25% of target.

**Bonus multiplier**: executive coach (+10%) and a prior-week A (+10%) stack, capped at +20% total — applied to `recognizedWeeklyPoints` before it feeds the weekly nudge, never to category baselines directly.

Points gate: nothing directly "unlocks" on point totals except contributing to weekly badges and the weekly nudge to the grade above.

---

## 4. Weekly Search Sprint / Success Sprint — `src/lib/weekly/`

Also called "Search Actions" or "Weekly Search Score" in various UI copy — all the same underlying `WeeklySprint` model.

### 4.1 Week boundary and lock mechanics

Weeks run Monday-Sunday (`getMondayOfWeek()`). Goal-setting has its own edge case: `getGoalSettingWeekStart()` bumps a Sunday reference forward one day, because the Sun 12:01am–Mon 12:01pm PT goal-setting window always concerns the week starting the *next* Monday — every caller that gates or writes the commitment must use this helper, not the plain Monday one, "otherwise a Sunday submission silently lands on the outgoing week's record."

`isSprintEditWindowOpen()` / `isLockTimePassed()` (`src/lib/weekly/pt-time.ts`) gate whether the current week's goals can still be edited (locks Monday 12:01pm PT).

### 4.2 Suggested actions and the four engines ("action catalog")

`getSuggestedActions()` blends: (a) up to 5 personalized items pulled from the most recent Sunday Night Report, or falling back to the Hireability Report's 7-day plan on week 1; (b) always-injected unfinished one-time items (salary/work-auth confirmation, How I Work Best quiz — pushed to the very front); (c) top-up from `CANONICAL_TASK_MENU` (`src/lib/weekly/task-menu.ts`) until the available point total comfortably clears the week's target (×1.5 buffer).

The four "engines" (candidate-facing labels): **Networking** (internally "connecting"), **Learning**, **Working**, and **Effort** (not shown as its own tile — its points fold into the visible weekly total).

### 4.3 Committing and auto-assignment

`commitWeeklySprint()` writes `WeeklySprint.committedActions` (JSON array), always prepending a `GOAL_DEFINED_BONUS_POINTS` (5pt) "Defined this week's goal" line, plus a one-time `INTRO_WELCOME_BONUS_POINTS` (5pt) "Completed your welcome & commitment" line on the very first sprint only.

If a candidate never sets goals themselves, `/api/cron/auto-assign-sprint` (Monday 20:05 UTC) auto-populates a sprint on their behalf via `autoPopulateFirstSprint`/similar logic — "I'll set an A-level goal for you automatically" (candidate-facing copy on the Hireability Report page confirms this is intentional, not a bug).

Mid-week extras: `logCatalogAction()` lets a candidate log something picked from "More Actions Available" (the broader catalog beyond the locked weekly commitment) — immediately marked complete, tagged `addedFromCatalog: true`.

### 4.4 A-List and Sunday Night Report — **legacy/dormant model, important gotcha**

The `SundayNightReport` Prisma model (append-only weekly digest: grade snapshot, strengths/weaknesses, suggested action plan, `onAList` flag, market response funnel) is **still read in several places** (`src/lib/weekly/sprint.ts`'s suggestion fallback, `src/lib/reports/dossier-sections.ts`'s week-count denominator, the Stats page's "Weekly Search Score trend" chart, `src/app/api/export-data`, admin metrics) — **but nothing in the current codebase creates new rows in it.** A repo-wide search confirms zero `.create()` calls against `prisma.sundayNightReport`. Multiple code comments confirm this explicitly: *"SundayNightReport.onAList is legacy and nothing writes to it anymore."*

What actually replaced it, live and currently written:
- **Market Reality Grade weekly snapshot** → `MarketRealitySnapshot` (`src/lib/scoring/market-reality-snapshot.ts`), generated by `/api/cron/market-reality-snapshot` (Monday 20:20 UTC, right after the sprint locks). Powers the Stats page's grade trend chart and grade history log.
- **A-List weekly membership** → `WeeklyBadgeEarned` rows with `badgeKey = 'WEEKLY_SCORE_A_LIST'` (written by `computeWeeklyBadges()`, computed live on every relevant page load — Stats page, Dossier, etc.).

Net effect for a maintainer: the Stats page's "Weekly Search Score trend" chart (sourced from `SundayNightReport.gradeSnapshot`) will show only whatever historical rows already existed before this transition — it receives no new data points going forward. Anyone re-enabling weekly-digest generation should be aware they're choosing between reviving `SundayNightReport` or building fresh off `MarketRealitySnapshot`/`WeeklyBadgeEarned`.

---

## 5. Daily mechanics

### 5.1 Mood check-in and streaks — `src/lib/daily/mood.ts`

`recordMoodCheckIn()` — one check-in per UTC day (re-checking the same day updates the mood, doesn't create a duplicate or bump the streak). Streak logic: `currentStreak` increments only if `lastCheckInAt` falls within the prior UTC day; otherwise resets to 1. `longestStreak` is a running max.

`getSentimentAlert()` — a real, threshold-based signal (not just descriptive UI copy): fires if the trailing 14-day mood average is below 30 ("mostly Stuck") **or** the first half of that window is meaningfully worse than the second half (declining-trend check). Surfaces `<SentimentSupportCard>` on the dashboard.

### 5.2 Daily action derivation — `src/lib/daily/primary-action.ts`

`getTodaysPrimaryAction()` cycles through the Hireability Report's 7-day action plan by elapsed days since report generation (`daysSince % 7`), pulling the day's first item. `frameActionForMood()` applies a templated (non-LLM) reframe based on today's mood — e.g. Stuck gets "just do the first concrete step," Fired Up gets an invitation to get a head start on tomorrow.

### 5.3 Daily action email — see §8.

---

## 6. Dashboard feature pages

All feature pages are gated behind `getDashboardData()` (see §1.1). File paths under `src/app/dashboard/` unless noted.

### References — `references/page.tsx`, `references/actions.ts`
Candidate requests a reference by name/email/relationship type (`requestReference` — blocked until `assessmentComplete`); sends `sendReferenceRequestEmail`. Candidates can dispute a completed reference (`disputeReference`, sets `candidateDisputeNote`) and must explicitly approve/reject any Victoria-drafted reference *quote* before it becomes Dossier-eligible (`reviewReferenceQuote`). See §9 for the full reference lifecycle.

### Work Samples — `work-samples/actions.ts`
Upload a titled/typed (case study, writing, code, design, presentation, other) sample with file or external URL; triggers `applyWorkSampleUploadedRewrite` (+5 Skills & Execution baseline, see §2.5).

### LinkedIn — `linkedin/actions.ts`
Unlock gate: openness comfort + usage frequency + profile-up-to-date. Shares its underlying `contentComfortLevel`/`contentVenues` fields with Thought Leadership so both surfaces draw from one post generator. Also offers AI-generated headshot and LinkedIn banner (`src/lib/ai/nanobanana.ts` — Nano Banana / Gemini image generation).

### Thought Leadership Studio — `thought-leadership/actions.ts`, `src/lib/network/thought-leadership.ts`
Unlock gate: comfort level + venue selection. `generatePostIdeas`/`draftPost` produce LinkedIn/Substack content ideas and drafts grounded in the candidate's real work history. Also supports connecting/analyzing an existing Substack (`analyzeSubstack`).

### Find My Job (job board + job-fit checking + job discovery) — `find-my-job/actions.ts`, `find-my-job/page.tsx`
This is the merged "Jobs" page (the old standalone `/dashboard/job-board` now just redirects here). Core loop:
- Paste a job URL → `fetchJobPosting()` scrapes it (falls back to pasted text for bot-blocked hosts like Indeed/LinkedIn, see `src/lib/jobs/blocked-job-hosts.ts`) → `analyzeJobFit()` scores fit.
- **Cap of 5 active tracked postings** at a time (`MAX_ACTIVE_FIT_CHECK_SLOTS`, `src/lib/constants/job-milestones.ts`).
- Full lifecycle tracked with real timestamps: `appliedAt` → `interviewLandedAt` (triggers `applyInterviewLandedRewrite` + `applyInterviewPatternConfirmedRewrite` + auto-generates interview prep) → `interviewCompleteAt` → `offerReceivedAt` (triggers `applyOfferReceivedRewrite` + auto-generates negotiation advice).
- Cover letter generation, thank-you-note generation (LLM), "prep for phone screen" (pre-loads the JD into Interview Prep's shared `activeJobDescription`).
- **Discover section**: `surfaceNewJobs()` (job discovery matching engine, `src/lib/network/job-discovery.ts`) keeps a rolling queue of 5 unreacted suggested jobs; candidate reacts Interested/Not Interested (with reason). Also shows the NC Job Board (`ExclusiveJobPosting`) — filtered by `audienceTier` (A-List gate, see §2.4), `distribution` (Open vs. Targeted-to-fit vs. Excluded), and `disclosure` (named company vs. confidential "soft-reveal handshake" via `requestJobBoardIntro`).
- A candidate can also submit their own found job lead into the shared board (`submitNetworkJobLead`, lands in admin's review queue as `source: 'candidate_referral'`).

### Support Network (My Network) — `network/page.tsx`, `network/actions.ts`
Candidate-built contact list, categorized (Former Colleague, Hiring Connection, Owes a Favor, Recent Transition, Could Help in Return) and warmth-rated. Target list size is **25 people** (`NETWORKING_LIST_TARGET`) — hitting it auto-marks `networkingListSubmittedAt` (kept in sync with the separate onboarding "networking list of 25" action-plan item so it's never asked for twice). Supports LinkedIn Connections.csv import (`parseLinkedInConnectionsCsv`), outreach logging (`logOutreach`), and market-response self-reports (`logMarketResponse` — replies/conversations/referrals/paid-project leads, distinct from the real JobPosting interview/offer timestamps). Ready-to-use outreach scripts and templates are pulled from `src/lib/constants/help-script-template.ts` and `network-email-templates.ts`.

### Interview Prep — `interview-prep/actions.ts`, `src/lib/interview-prep/`
Generates a candidate "core narrative" + situational adaptations (`generateCoreNarrative`/`generateAdaptations`, see Portfolio below — shares the same underlying model). Practice loop: `requestToughAnswer` (LLM generates a hard interview question), `requestPracticeEvaluation`/`requestToughAnswerFeedback` (LLM evaluates a typed answer, checks for STAR structure), `requestThankYouEmail`. `activeJobDescription` is a single shared field other surfaces (Find My Job's "prep for phone screen") write into so prep stays grounded in one specific role.

### Portfolio (named narratives) — `portfolio/actions.ts`, `src/lib/narrative/`
Multiple named `CandidateNarrative` rows per candidate (create/rename/delete/regenerate/edit statement). The earliest-created narrative is the implicit, undeletable "default" that Interview Prep, guides, and profile-share all read from.

### Coach Dossier — `coach-dossier/page.tsx`
Read-only mirror of exactly what the candidate's coach sees (Dossier sections + Coaching Notes), gated on `coachDossierConsentedAt`. Shows an "off for both of you" state before consent is granted, with a link to Privacy settings.

### Hireability Report — `hireability-report/page.tsx`, `src/lib/reports/hireability-report.ts`
The full candidate-facing narrative report — see §6a below for the generation logic in detail.

### Recruiter Report / Certified Executive Dossier — `recruiter-report/page.tsx`, `src/lib/reports/recruiter-report.ts`, `src/lib/reports/dossier-sections.ts`
Despite the route name ("recruiter-report"), this page is titled **"Certified Executive Dossier"** in the UI — the same document a candidate can hand to a recruiter/hiring manager/coach. Candidate controls when it's generated/shared; never sent automatically. Nine dynamic sections (`DossierSectionId`): Positioning Statement, How I Operate, What Drives Me, AI Fluency, Impact on People, Self-Awareness, Learning & Growth Trajectory, Fit, Proof-Point Narratives.
- **Dynamic reweighting**: sections whose content directly addresses a currently-named Market Reality *gap* (`SECTION_ADDRESSES_GAP` mapping — e.g. Positioning ↔ `presentation_gap`, Impact on People ↔ `socialProof_gap`) get promoted to the top, with an explicit "closed-loop callout" explaining why.
- **What's structurally excluded, by never being queried**: financial-pressure/Benefits data, raw score numbers, mood/check-in data, coaching session notes, raw Support Network message content, raw calendar details.
- Character-signal references need `CHARACTER_SIGNAL_MIN_REFERENCES` (see `src/lib/reports/evidence-type.ts`) before they're shown — "a single account isn't enough to triangulate against."
- The `DOSSIER_COMPLETE` milestone badge (§3.2) tracks completeness of all 9 sections via a cheap non-LLM check (`isDossierComplete()`), separate from the expensive live-generating `getDossierSections()`.

### Hireability Report — see §6a.

### Stats page — `stats/page.tsx`
The "full detail" view behind the dashboard summary: Market Reality Grade + delta vs. last week, Weekly Search Score points, Badge shelf (weekly + milestone), grade trend chart (from `MarketRealitySnapshot`), Weekly Search Score trend chart (from legacy `SundayNightReport` — see §4.4 caveat), mood/motivation chart (private — "never part of any export, never visible to hiring managers or recruiters"), activity heatmap, last week's actions, grade history log, streak details, per-engine breakdown, full available-actions catalog, and the private Weekly A-List history ("never a public leaderboard").

### Community / Support Network feed — `community/page.tsx`, `community/actions.ts`
Posts (`UPDATE` or `SELF_INTRO` only — job/project/intro-offer post types still exist in the enum for historical posts but aren't creatable from the composer anymore). Posting requires `privacyTier` PUBLIC or SEMI_PUBLIC (re-checked server-side, never trust the client gate). Posting an `UPDATE` auto-completes the `ENGAGE_POST_UPDATE` weekly action (real behavior, not a self-report toggle). Candidates can send anonymous or attributed encouragement notes (`sendEncouragementNote`, requires opting in via Privacy settings first) and express interest in another candidate's post (`expressInterest`, notifies the poster).

### Benefits, Gig Directory, Learning, Got Hired — each follows the same "unlock question → generate a personalized plan" pattern:
- `benefits/actions.ts` → `generateBenefitsPlan`
- `gig-directory/actions.ts` → multi-phase interim/fractional launch plan (`gigDirectoryUnlockAnswer`, `interimOfferDefinition`, `markInterimOutreachStarted`)
- `learning/actions.ts` → logs course completions and **AI project judgment calls** (`logAiProject` — the raw description is LLM-polished via `polishAiProjectDescription`; the `judgmentCall` field specifically is what feeds the `AI_FLUENT` badge and the Dossier's AI Fluency section and the grading system's AI-fluency named-reason). Triggers `applyLearningClosesBarrierRewrite` (+8 Skills & Execution, only if the candidate named "skills_gap" as a barrier during onboarding).
- `got-hired/actions.ts` → `submitBountyClaim`, the A-grade-gated Offer Bonus (see §2.4). Requires company/role/start date + an uploaded offer letter (PDF/PNG/JPG, ≤10MB).

### Coaching Match / Coaching Form — `coaching-match/page.tsx`, `coaching-form/page.tsx`
Coach-matching preference form (gender/communication-style/language/timezone preferences → `generateCoachShortlist`) and the Coaching Onboarding Form (same one referenced in onboarding step 8, reachable again later from `/dashboard/privacy` if consent is granted after the fact).

### Messages — `messages/page.tsx`, `messages/actions.ts`
Threaded messaging (`sendCandidateMessage`, `markCandidateThreadRead`) — thin wrapper around `src/lib/messaging/threads.ts`.

### Privacy — `privacy/page.tsx`, `privacy/actions.ts`, `privacy/share-actions.ts`
Privacy tier (`PUBLIC`/`SEMI_PUBLIC`/`PRIVATE`/`STEALTH`/`LOCKED`), notification tier, SMS consent, recruiter-database opt-in, coach disconnect/reconsent, and **account deletion** (`deleteMyAccount` — cascades through every related row via `onDelete: Cascade`, then deletes the Supabase auth user). Also owns **Profile Share links** (`createProfileShare`/`revokeProfileShare`) — the mechanism behind `/share/[token]` (see §6b).

### Support During Transition — `support/page.tsx`
Static resource page (988 crisis line, therapist directories, EAP note, link to Executive Coaching). Explicitly "private, optional, never affects your grade... not triggered by your activity."

### Profile, Guides, Job Discovery — thin pages; profile confirmation actions live in `dashboard/actions.ts` (`confirmProfile`, `confirmIndustry`, `confirmFunctionAndExperience`, `confirmLinkedIn`, `confirmSalaryAndAuthorization`) — each stamps its own `*ConfirmedAt` timestamp, which is what both the weekly-action-verification system and the Hireability Report's per-item action-plan logic check.

### 6a. Hireability Report generation — `src/lib/reports/hireability-report.ts`

LLM-generated (Claude, `claude-opus-4-8`, structured output via Zod schema) report: **Strengths** (3-6), **Weaknesses** (2-5, framed as an "accountability mirror," not a nitpick list), **Hill to Climb** (one of `very_positive`/`positive_with_work`/`significant_climb`, 2-5 sentences), a **7-day Action Plan**, **Gap Analysis** (remediation types: upskilling / fractional-contract / consulting / networking / other), and optional **Market Conditions** commentary.

Notable hard-coded prompt rules (all literally labeled "HARD REQUIREMENT" in the prompt):
- Never cite a raw numeric score anywhere — letter grade only.
- If the candidate hasn't started a Search Sprint yet, don't invent an execution narrative.
- Never include "commit to your Search Sprint" as an action-plan item — that's the platform's own mechanic, not a real task.
- If a management/IC-preference conflict is detected (`detectManagementGoalConflict`), name it directly — never suggest the candidate secretly wants to manage, but be honest about the trade-off.
- If pivoting, straight talk about the extra difficulty is mandatory — never soften it, never call the pivot itself a mistake.
- Each of the 7 action-plan days is populated conditionally based on live profile-confirmation state (resume, LinkedIn, networking list, "asked for help," profile/industry/function/salary confirmations) — items are added only if not-yet-done, explicitly removed once done.
- Written in Victoria's voice (`VICTORIA_VOICE_PROMPT`), calibrated by `computeDirectnessLevel()` (see §7).

**Regeneration gate**: a candidate can only regenerate their report after completing `TASKS_REQUIRED_TO_REGENERATE_REPORT` tasks (`src/lib/dashboard/completed-tasks.ts`) since the last one — reports are otherwise a frozen snapshot.

**First-report grace**: if this is the candidate's very first report and the grade computes to F, it's displayed as "N/A — not enough signal yet" instead, since a first-ever report has no real track record behind it.

### 6b. Profile sharing — `/share/[token]`, `src/lib/sharing/profile-share.ts`

Candidate-controlled, revocable, expiring (7 days / 30 days / never) links scoped to a recipient type (Hiring Manager / Recruiter / Coach), with an `includeExtras` allowlist. The public share page shows core statement, known-for, background, work history, resume link, references, and the Market Reality Grade — explicitly notes "private coaching conversations are never included."

---

## 7. Victoria — the AI coach persona

Defined in `src/lib/victoria.ts`. Disclosed as AI immediately and honestly, but with a consistent name/voice across every surface: Hireability Report, coach chat, daily/weekly emails, onboarding score reveal.

**Three names, context-dependent** (`getVictoriaName()`):
- **Victoria** — introduction, grade reports, hard truths (formal contexts)
- **Vicki** — casual chat, warm check-ins
- **Vic** — daily emails, quick encouragement/celebration

**Voice rules** (`VICTORIA_VOICE_PROMPT`, prepended to every LLM call written in her voice): warm but direct, never generic motivational language ("you've got this"), names avoidance patterns without shame, "peer-level, not a cheerleader and not a therapist — the best manager they ever had," first person, signs off "— Victoria" only where the surface calls for a signature.

**Directness calibration** (`src/lib/scoring/directness-level.ts`) — a separate axis from voice, tied to program tenure and search urgency: `provisional` (early or not time-pressured) → `direct` (weeks 5-8) → `straight` (weeks 9-12) → `reckoning` (13+ weeks, no results change). Each level has specific required opening phrasing baked into the system prompt (e.g. reckoning: *"After this many weeks, the data is telling me something important..."*), always followed by *"I'm not being hard on you — I'm being real because I want you to succeed,"* and always ending with one concrete next action — "never punitive or shaming." Casual searchers (`isCasuallySearching()`) are always kept at `provisional` regardless of tenure.

**Where she appears**: the score-reveal page (`<VictoriaAvatar>`), the coach chat card on the dashboard (`getOrCreateCoachConversation`, `src/lib/coach/get-conversation.ts` and `src/lib/coach/generate-reply.ts`), the Hireability Report, and the daily action email.

---

## 8. Notifications / emails sent to candidates

All send functions live in `src/lib/email/`, use Resend, and no-op with a console warning if `RESEND_API_KEY` is unset. Every recurring email respects the candidate's `NotificationTier` (MINIMAL/ESSENTIALS/FULL) via `shouldSendDailyEmailForTier` (`src/lib/email/notification-tier.ts`) and carries an unsubscribe link.

| Email | Trigger | Notes |
|---|---|---|
| **Week 1 kickoff** (Victoria) | One-time, day 1 after registration (checked inside the daily-email cron) | Replaces the regular daily email for exactly one send |
| **Daily action email** ("Your one thing for today") | `/api/cron/daily-action-email`, 13:00 UTC daily | LLM-personalized insights (`generateDailyInsights`); "reset" framing if no check-in in 3+ days; gated by notification tier |
| **Hireability Report ready** | Event-based: first dashboard load after registration (`after()` callback in `getDashboardData`), and again as a fallback on every Hireability Report page load if `emailSentAt` is still null | Atomically claimed via `updateMany({ where: { emailSentAt: null } })` to prevent double-send races |
| **Registration reminder** ("Finish creating your account") | `/api/cron/registration-reminders`, 14:00 UTC daily | Targets candidates who finished the assessment but never confirmed their account; includes a magic link |
| **Sprint goal — open** | `/api/cron/sprint-goal-open`, Sunday 08:05 UTC | Opens the weekly goal-setting window |
| **Sprint goal — reminder** | `/api/cron/sprint-goal-reminder`, Monday 08:05 UTC | "You haven't set this week's Search Actions yet" |
| **Sprint goal — final reminder** | `/api/cron/sprint-goal-final-reminder`, Monday 18:35 UTC | "Your Search Actions lock in about an hour" |
| **Weekly gap nudge** | `/api/cron/weekly-gap-nudge`, Friday 21:00 UTC | "N points from an A this week" |
| **Community & coaching digest** | `/api/cron/community-coaching-digest`, Saturday 15:00 UTC | Encouragement-notes-received count + whether they had a coach session |
| **Market digest (candidate)** | `/api/cron/market-digest-candidates`, Tuesday 14:00 UTC | Local market conditions (Adzuna count, BLS YoY) + one curated market "nugget" |
| **Interim role check-in** | `/api/cron/interim-role-reverify`, 14:00 UTC daily | "Still doing your interim work at X?" — one-click still-active/ended response links |
| **Post-interest notification** | Event: another candidate expresses interest in your Community post (`expressInterest`) | Sent to the poster |
| **New message notification** | Event: a new thread message | `send-new-message-notification.ts` |
| **Resume lead confirmation** | Event: homepage/anonymous resume-drop lead (`submitResumeLead`) | "We got your resume" — separate from the full onboarding flow |
| **Reference request** | Event: `requestReference` action | Sent to the referee, not the candidate |

**Not candidate-facing** (included for completeness, since they're triggered by candidate/employer actions): `send-layoff-context-alert.ts` (internal admin alert on an employer's layoff submission), `send-pr-hook-alert.ts`, `send-product-positioning-flag.ts`.

**Deferred/not yet live** (per the user's own memory notes): Twilio SMS send, Google Meet/Calendar/Gmail API integration — `smsPhone`/`smsConsentedAt` are collected but actual SMS sending is blocked on account setup.

---

## 9. Reference & employer-reference flows

### 9.1 Candidate-initiated (the normal path)

1. Candidate fills out name/email/relationship type on `/dashboard/references` → `requestReference()` creates a `Reference` row (status starts non-COMPLETED) and emails the referee a tokenized link.
2. Referee visits `/ref/[token]` (`src/app/ref/[token]/page.tsx`) and submits the reference form → `submitReference()` (`src/app/ref/[token]/actions.ts`).
   - Token expiry: `REFERENCE_TOKEN_EXPIRY_DAYS` from `requestedAt` — expired links flip status to `EXPIRED`.
   - On success: `status = COMPLETED`, triggers (all best-effort, never blocking the referee's submission) `syncReferenceDelta()`, `generateReferenceQuotes()` (LLM-extracted quotable testimony — candidate must separately approve each quote before Dossier-eligibility, see §6 References), and `applyReferenceCompletedRewrite()` (the baseline bump, §2.5).
   - Redirects to `/ref/[token]/complete`.

### 9.2 Employer-initiated (former employer proactively leaves a reference)

This path starts on the employer side (out of scope for this doc — `src/lib/employer-references/submission.ts` shows only the shared validation: name/company/work-email required for the submitter, name/email required for the departing employee — "no real company-email-domain verification exists anywhere in this app... a named, real-looking contact is the trust gate instead").

1. Employer submits → creates an `EmployerReferenceSubmission` row (status `pending`), a real `token` invite link is generated and (presumably) emailed to the departing employee.
2. Candidate visits `/claim-reference/[token]` (`src/app/claim-reference/[token]/page.tsx`) — **requires authentication** (`getDashboardData()` forces login first), so claiming is always a deliberate, authenticated action by the actual subject of the reference, never anonymous or on someone's behalf.
3. Candidate reviews the content (strength summary, superpower quote, defining story, would-hire-again) and either:
   - **Accepts** (`acceptEmployerReference`) — creates a real `Reference` row (status `COMPLETED` immediately, all BARS/trait fields copied over), marks the submission `claimed`, and runs the **exact same downstream effects** as a normal completed reference (`syncReferenceDelta`, `generateReferenceQuotes`, `applyReferenceCompletedRewrite`).
   - **Declines** (`declineEmployerReference`) — marks the submission `declined`; nothing is ever created from it.

Until claimed, an `EmployerReferenceSubmission` is invisible to `Reference`-consuming surfaces (Dossier, Coaching Notes, grading) — "nothing here is reachable... before this."

---

## Appendix: candidate-side entry points not otherwise covered

- `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/magic-link`, `/auth/reset-password` — standard Supabase-backed auth pages (`src/app/auth/*`).
- `/refer` (`src/app/refer/page.tsx`) — static referral-share page (`<ReferralShareBox>`), no gating, "NextChapter is free for candidates — always."
- `/submit-resume` (`src/app/submit-resume/page.tsx` + `actions.ts`) — anonymous/pre-account resume-drop lead capture (separate from the onboarding resume upload), creates a `ResumeSubmissionLead` and sends a plain confirmation email; if the visitor happens to already have a session, `candidateId` is attached.
- `/start/[persona]` (`src/app/start/[persona]/page.tsx`) — persona-specific marketing/landing pages that pre-seed the onboarding "situation" answer via `SITUATION_TO_JOB_STATUS`; personas defined in `src/lib/constants/personas.ts`.
