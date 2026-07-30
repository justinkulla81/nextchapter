# Database Schema

`prisma/schema.prisma` is the authoritative source — every field has inline comments explaining *why*, not just what, and this doc won't repeat all of that. This is the readable map on top of it: what the 69 models are, grouped by domain, and how they relate. Read `schema.prisma` directly when you need exact field names/types.

Some house rules that apply schema-wide, worth knowing before you read anything else:
- **No `prisma migrate` history** — schema changes are pushed directly with `npx prisma db push --skip-generate` then `npx prisma generate`. There are no migration files to reconcile.
- **IDs are `cuid()`**, not UUIDs or auto-increment ints.
- **Soft-delete / append-only patterns are common** — several models (`Resume`, `HireabilityReport`, `MarketRealitySnapshot`, `SundayNightReport`) are append-only history logs, not update-in-place rows; "current" means "most recent by `orderBy`," not a status flag.
- **`isSampleData` flags** exist on a few models (`EmployerProfile`, `RoleProfile`, `Coach`, `Recruiter`) to mark seeded/demo rows distinctly from real data.

## Candidate core

- **`CandidateProfile`** — the center of the schema. One row per candidate, ~150 fields covering: onboarding answers (situation, working style, experience, goals), the Hireability Assessment, grading (`categoryBaselineScores` — the persisted per-category baseline the weekly grade nudges off of), points/streaks, privacy tier, notification preferences, gating timestamps (`assessmentComplete`, `introCommittedAt`, `registrationCompletedAt`, etc. — see `src/lib/dashboard/get-dashboard-data.ts` for the exact gate order), and foreign keys tying it to almost every other candidate-side model. If you only read one model, read this one.
- **`WorkHistoryEntry`** — structured work-history rows (replacing free-text resume parsing for anything that needs to be queried), including fractional/interim engagement handling.
- **`CandidateNarrative`** — one or more "core story" scenarios (Portfolio feature); the earliest-created row is the default "My Story" everything else reads.
- **`Reference`** / **`ReferenceQuote`** — candidate-requested references, BARS-scored + five character traits + open-ended questions; `ReferenceQuote` is Victoria-drafted pull-quotes that require explicit candidate approval before they're Dossier-eligible.
- **`WorkSample`**, **`InterviewResponse`** (feature currently unlinked from nav — see `IDEAS.md`), **`PeerNomination`**, **`LearningBadge`** — supporting proof-of-work content types.
- **`AssessmentResult`** — generic container for instrument results (`assessmentType` distinguishes them); the live Work Style instrument uses the Quad-block models below instead.
- **`QuadBlock`** / **`QuadBlockStatement`** / **`LikertItem`** / **`CandidateAssessmentResponse`** / **`BARSAnchor`** — the Work Style Assessment instrument: ipsative forced-choice quad-blocks + Likert cross-validation, scored into 8-9 dimension vectors with an inconsistency/manipulation-risk check. `CandidateAssessmentResponse.referenceDelta` is where a candidate's self-rated vector gets compared against BARS-scored reference feedback.

## Reports & grading

- **`HireabilityReport`** — append-only; each generation is a new row (strengths, weaknesses, 7-day action plan, gap analysis, market conditions, grade snapshot at generation time).
- **`WeeklySprint`** — one row per candidate per week: committed actions with difficulty + completion tracking.
- **`SundayNightReport`** — append-only weekly digest (grade snapshot, market response funnel, A-List status at the time).
- **`WeeklyBadgeEarned`** — the real, currently-written source of truth for weekly badges including A-List membership (`WEEKLY_SCORE_A_LIST` rows) — not `SundayNightReport.onAList`, which is legacy and nothing writes to it anymore.
- **`MarketRealitySnapshot`** — separate permanent weekly archive of grade + structured "named reasons," generated right after the sprint locks each Monday; feeds the Stats page trend graph.
- **`MarketResponseLog`** — self-reported external signals (reply, conversation, referral, paid-project lead) logged as they happen, aggregated into the Sunday report.
- **`MarketConditionsSnapshot`** — shared cross-candidate cache of Adzuna/BLS market data by (role, metro), 48h TTL — exists because Adzuna's free tier caps at 1,000 calls/month app-wide.
- **`DailyCheckIn`** — one row per candidate per day, mood + streak tracking.
- **`PivotIdea`** — AI-generated adjacent-role suggestions with candidate rating.

## Jobs

- **`Resume`** — append-only upload history; file lives in the private `resumes` Storage bucket, only a `filePath` is stored (signed URLs generated on demand).
- **`JobPosting`** — the candidate's own private, capped-at-5 job-fit tracker (paste a URL → get fit score, tailored bullets, cover letter, interview prep, negotiation advice — all generated and stored here as the candidate progresses through the funnel: applied → interview → offer).
- **`SurfacedJob`** — algorithmic per-candidate job matches (from the job-source waterfall) with a lightweight Interested/Not Interested/Unsure reaction.
- **`ExclusiveJobPosting`** — the shared NC Job Board: a single admin-curated list, now also accepting employer/recruiter self-submissions and direct ATS feed rows. `status` (`pending`/`approved`/`rejected`) is the trust gate in place of real domain verification (see `IDEAS.md`); `audienceTier`/`distribution`/`disclosure` control who sees what.
- **`JobBoardIntroRequest`** — a candidate's "request intro" click on a confidential listing, now a real persisted row (used to only fire an analytics event).
- **`JobClickEvent`** — click-through log across `SurfacedJob`/`ExclusiveJobPosting`, denormalized (title/company/location copied at click time) so admin can `groupBy` without joining three differently-shaped job tables.
- **`LinkedInActivityLog`** — one-per-day self-reported "I posted on LinkedIn" log.

## Community & network

- **`CommunityPost`** / **`CommunityPostInterest`** — the merged Community/Support Network feed (jobs, projects, intros, updates); interest-expression never exposes the interested candidate's email on the post itself.
- **`EncouragementNote`** — anonymous-by-default peer support messages.
- **`SupportNetworkContact`** / **`OutreachLog`** — the personal 5x5 network builder and self-reported outreach log (no automated send-verification exists — see `IDEAS.md`).
- **`ProfileShare`** — "What They See": candidate-generated, revocable, recipient-typed (hiring manager/recruiter/coach) links exposing a sanitized profile slice. Distinct from `PrivacyTier`, which is passive marketplace visibility.

## Reports/dossier-adjacent

- **`BountyClaim`** — the $500 "got hired" bounty: candidate self-report + offer-letter upload, admin-reviewed, payment always sent manually outside the app (`paidAt` is a record, not a trigger).

## Employer / Hiring Manager side (Talent portal)

- **`EmployerProfile`** — one per employer account; subscription tier/status (Stripe fields present but unused — see `IDEAS.md`), culture-assessment fields (Pro-tier matching), no-ghosting commitment.
- **`EmployerSeat`** — team seats additive to the original single-owner model; `userId` null until the invited teammate accepts.
- **`RoleProfile`** — a specific open role with its own work-style requirements and honest tradeoff declarations (`offersMoreThan`/`offersLessThan`).
- **`SavedSearch`** — employer's saved candidate-search criteria with optional digest.
- **`CandidateInteraction`** — the actual employer↔candidate match record: status funnel (viewed → saved → interest expressed → revealed → in conversation → hired/passed), computed match scores, and post-hire outcome ratings (30/90/180-day) for validity research.
- **`ApprovedEmployer`** — candidate's explicit per-employer approval (opt-in, separate from the general `recruiterDatabaseOptIn`).

## Coach portal

- **`Coach`** — P0-lite by design: `accessToken`-gated (not necessarily Supabase-authenticated, though `userId` can be attached), white-label branding fields, matching-algorithm self-description fields, standing onboarding-question template.
- **`CoachClientInvite`** — a coach inviting one specific known email (skips the generic click-to-confirm path).
- **`CoachSession`** — a logged 1:1 session: coach-private notes, client-facing directives, a `focusNote` that surfaces on the candidate's *next* Pre-Session Brief.
- **`CoachingOnboardingResponse`** — candidate-completed kickoff form, requires `coachDossierConsentedAt` already set.

## Recruiter portal

- **`Recruiter`** — same P0-lite shape as `Coach`.
- **`SourcedCandidate`** — a recruiter's private book of people from their own network who aren't NC users yet; once they sign up they become an ordinary `CandidateProfile` (linked via `sourcingRecruiterId`), and this row just keeps the recruiter's tracking (including `resumeCommentary` and the `inBook` curation flag for the submittable candidate book).
- **`CalibrationMemo`** — persisted output of the Instant Search Calibration Memo tool.

## Messaging (shared across candidate/coach/recruiter/employer)

- **`MessageThread`** — one thread per (candidate, partner) relationship, not per-subject; a candidate can have at most one active thread per partner type (coach/recruiter/employer) simultaneously.
- **`Message`** — individual messages, `senderRole` distinguishes who sent it.

## Admin / platform-wide

- **`InterviewQuestionBank`**, **`LayoffCohort`** — static/curated content the admin manages.
- **`WaitlistSignup`**, **`CoachingWaitlist`**, **`ResumeSubmissionLead`**, **`GuideLead`** — four distinct lead-capture models, kept separate (rather than one generic table) because each has its own required fields and follow-up behavior (synchronous email, filterable columns, etc).
- **`DashboardMessage`** / **`CandidateMessageDismissal`** — admin-authored rotating dashboard message feed with one always-pinned orientation message and an optional sequenced first-login series.
- **`ApiUsageCounter`** — sitewide per-month call counter for metered third-party APIs (currently just JSearch's 200-call/month free tier).
- **`ResearchLibraryItem`** — every externally-ingested article/URL, AI-classified into one of 5 buckets (`ResearchBucket`), with confidence scoring and a `needsReview` flag for low-confidence classifications.
- **`GoogleInboxConnection`** — the one company-owned Gmail research inbox connected via OAuth (not a candidate's personal account — explicitly lower CASA/scope burden).
- **`DigestSend`** — aggregate (not per-recipient) log of each Weekly Market Digest run, per audience.
- **`AnalyticsEvent`** — Postgres mirror of every server-side `captureServerEvent()` call (client-side `posthog.capture()` calls are not mirrored here).
- **`EmployerReferenceSubmission`** — Prompt 65's "Give a Reference" flow: an employer/manager leaves a reference for someone before that person has an NC account. Deliberately a fully separate model from `Reference` (not a nullable-`candidateId` variant of it) so the "nothing becomes visible or usable until the invited person explicitly accepts" consent guarantee holds by construction — accepting is the one moment a real `Reference` row gets created.

## Enums worth knowing

`PrivacyTier` (LOCKED → PUBLIC, 5 levels), `EmploymentSituation` (~20 values — the "why you left" taxonomy used across onboarding/reports), `Mood` (STUCK/GETTING_THERE/MOVING/FIRED_UP), `ReferenceType`, `ContactCategory` (the 5x5 builder's 5 categories), `JobReactionType`/`NotInterestedReason`, `EmployerTier` (CHARTER/STANDARD/PRO), `ThreadPartnerType`/`MessageSenderRole` — full list and values are at the top of `schema.prisma`.
