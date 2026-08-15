# Open Items, Loose Ends, and Deferred Work

Living document. Compiled from everything flagged during the Phase 2 / Partners / Search-Visibility build session. Update this file as items get resolved — don't let it go stale.

Last updated: 2026-08-14 (during active build session).

---

## Blocking infrastructure that doesn't exist yet

These are referenced as if real by one or more spec documents, but have zero implementation. Anything built on top of them was built with an honest "not available" fallback, never a fabricated value.

- **WARN monitoring agent.** Zero implementation anywhere in `src/`. Referenced as existing infrastructure in `NextChapter_Competitive_Strategy.md`, `NextChapter_Partners_Master_Build_Script.md`, and `NextChapter_PHASE2_MASTER_SCRIPT.md` (Part C, Part D §4). Blocks: `CompanySignal.trajectory`'s WARN-override rule (currently posting-signal-only), the "Contraction signal" UI card on company pages (renders "not available"), the admin "outplacement pitch signal" composite (WARN component always shown as "not available", never fabricated), and all of Part D §4 (WARN alerts to affected/targeting members) — not built at all.
- **`ncrawl` aggregate-by-industry/metro posting-volume table.** Doesn't exist. Blocks Part B's population-report "Targets and demand" ncrawl cross-reference (thin-market surfacing) — built without it, explicitly noted as skipped rather than faked.
- **Resume Studio.** Referenced in Part B Prompt 3 ("each save inside Resume Studio") and elsewhere. Only resume upload + the new Guided Resume Walkthrough exist — no free-form editor/tailoring surface. The resume-issue capture pipeline only has a real hook at upload time; "Resume Studio save" capture is N/A until that surface is built.
- **A real 4-value persona field.** `CandidateProfile` has no `persona` field — only the pre-existing `currentJobStatus` (7-value `CurrentJobStatus` enum), set once at onboarding. Confidential Search Mode's persona-based default (ON for Worried/Resigned) is a lossy reverse-map from this enum, not an exact match (per explicit user decision — documented in code comments where the mapping lives).
- **A comment/reply model on `CommunityPost`.** Doesn't exist — only reactions. The Weekly Leaderboards' Contribution board is scoped to reactions-only per explicit user decision, not the spec's literal "reply or reaction."

## Resolved during this session

- ~~**`CurrentJobStatus` had no post-onboarding write path.**~~ **Fixed** (commit `d4f2004`). A "Your situation" control now lives on the Privacy page (`CurrentJobStatusSelector` + `updateCurrentJobStatus` in `src/app/dashboard/privacy/actions.ts`) — a candidate can update it any time, deliberately without auto-touching `confidentialSearchMode`. The Passive-to-Active prompt's persona-change trigger can now actually fire in production.

## Data hygiene — needs your attention

- **8 real seeded test candidates had `currentJobStatus`/`searchIntensity` mutated during Part C Phase B verification testing** and could not be safely reverted (the agent discovered they already held real prior-session values and chose not to risk nulling legitimate data). Affected: 2 candidates now show `EMPLOYED_CONSIDERING_MOVE`, 6 now show `ACTIVELY_SEARCHING`. If you're using these same seed candidates (`justin.kulla+1@gmail.com` through `+50`) for other testing, this is worth knowing.
- **`seed:resumes` has only been run for 1 of the 50 seed candidates.** Running it for all 50 costs ~100 real Anthropic API calls (real, recurring LLM cost) — deliberately not run automatically. Run `npm run seed:resumes` yourself when you want the full seed population's resume-issue data.

## Deliberately deferred (by design, not oversight)

- **The pre-registration onboarding wizard was never merged into "one dashboard."** §12's literal spec text ("no separate onboarding surface") was interpreted narrowly — the account-creation/resume-upload/anonymous-session flow was left untouched, since collapsing it fully is a much higher-risk rewrite of the new-signup path. The post-registration dashboard got the full 3-zone activation-checklist treatment instead.
- **§16 fixture-harness gates 15, 16, 17** (gap-duration scoring, interim-resets-the-clock, volume-vs-strategy effort split) are not built — the underlying scoring-engine behavior doesn't exist. Code comments reference a "§3.1–§3.9" of the master script for this exact logic, but that section is **not present in the currently committed spec doc** — if you have it, it would unblock real engine work here instead of leaving this deferred indefinitely.
- **§16 gates 10, 12, 13** need real DB-backed test candidates; this repo has no test-database infrastructure (a setup decision, not a code gap).
- **§16 gate 11** ("no sibling rendering") is a UI-rendering assertion; a scoring-output fixture harness structurally can't verify it — would need a component test instead.
- **Community's "prompted formats over open feed"** (§14 — structured intro/win/ask composer replacing the open textarea) was explicitly scoped out as a separate-sized UX redesign task.
- **`markResumeFixApplied`** (the legacy `analyzeResume` feedback-item "mark as fixed" flow) was deliberately **not** wired to the new `ResumeIssue` resolution-tracking table — there's no reliable correlation between the two pipelines' extracted text, and a fuzzy match risked silently corrupting fix-rate analytics.
- **Resume-Studio-§3.9 "version conversion" stats item** (Part Four §20) skipped — the referenced feature doesn't exist.

## Known-thin, real-but-partial

- **ATS failure matrix** (Part B admin `/issues` view 5) covers 7 real parser profiles, not the spec's 12 named engines — several platforms (Greenhouse/Lever/Ashby/Workable) share one simulated engine in the existing `ats-matrix.ts`, so they can't be broken out individually without new simulation work.
- **`Community` groups.ts privacy gap (pre-existing, not fixed).** The "peers at your company" Community grouping has no minimum-cell-size suppression and doesn't filter out current employees — a candidate can infer "N others work/worked at my employer" with N as low as 1. This predates this session's work and was flagged three separate times (Part C Phase A, Confidential Search Mode Phase A) without being fixed, since each time it was out of scope for the task at hand. **This is the single most concrete "go fix this" candidate on this whole list** — it directly undermines a privacy guarantee (Confidential Search Mode / insider-network anonymity) that other, newer code now depends on being real.

## Copy / legal-adjacent, flagged not written

- **Privacy policy** doesn't yet cover "aggregate employer-level statistics may inform which companies we approach about outplacement services" language that Part C's nervous-employee admin panel requires per spec §7 point 7. Deliberately not drafted without more context — this is legal-adjacent copy.

## Spec documents with incomplete or pending content

- **`docs/specs/NextChapter_Partners_Master_Build_Script.md` is truncated mid-sentence** in §A7 (Employer portal). Parts B (shared design system + differentiation cues), C (positioning/messaging/site architecture/waitlists), D (competitive strategy vs. LHH/RiseSmart/Careerminds/INTOO — likely overlaps with or supersedes the separate `NextChapter_Competitive_Strategy.md`), and E (build sequence + open decisions) were never sent. Task #969 is blocked on receiving the rest of this document.
- **`docs/specs/NextChapter_Competitive_Strategy.md`** may be fully superseded by Part D of the Partners script once received — don't build both independently; reconcile at that time.

## Analytics verification pass (completed)

An independent agent verified — not just checked for the presence of code, but confirmed correctness — every PostHog event across this session's ~198 changed files. Found and fixed real gaps (commit `1fb9177`): 5 admin community-moderation actions had zero events; `revokeProfileShare` was missing one while its sibling had one; `profile_share_created` fired with an empty payload; two candidate actions (`deactivateCommunityPost`, `dismissEncouragementNote`) were uninstrumented; both new CSV export routes (issues, population report) had no events; and the two OAuth corporate-domain hard-blocks (Gmail, Google) silently redirected with no event.

Two remaining gaps were flagged, not fixed, because fixing them cleanly requires touching files outside this session's scope and no established client-side capture pattern exists to follow:
- **`MarkAppliedForm.tsx`**'s "this looks like your current employer" confirmation click — the action it gates lives in `find-my-job/actions.ts`, untouched this session.
- **`CreateAccountForm.tsx`**'s corporate-email warning interstitial — gates `setCandidateEmail` in `onboarding/create-account/actions.ts`, also untouched this session.

## Performance audit pass (completed)

An independent agent audited every new page/route from this session for render-blocking calls, N+1 queries, and unbounded lists. Fixed (commit `a4375ce`): both company detail pages had a real Anthropic classification call blocking the entire page's first paint on a cold company — now Suspense-isolated behind a shared `CompanyMetaLine` component; the admin population report had up to 12 sequential DB round trips in a segment loop, now batched to 2 parallel groups; admin issue analytics, the resume walkthrough review step, the stats page's badge computation, and the References request action each had one avoidable sequential `await` merged into an existing `Promise.all`; and two unbounded lists on the candidate company page (published intel, insiders) got the existing `ShowMoreList` pagination pattern. Two other spots were checked and left alone as genuine data dependencies, not oversights.

## Data collection → consumer mapping audit (completed)

Six parallel research agents traced every user-provided field in the schema — onboarding, Search Strategy, all assessments, References, work history, Track Record, What I Need, Community/Network interactions — to its real downstream consumers (scoring engine, reports/narrative, points/gamification, unlock gates, matching, admin display). This was pure research, no code changes. Most of the app's ~250+ collected fields are genuinely, heavily used — the scoring engine, Market Reality Report, Executive Dossier, Coaching Notes, and matching/personalization logic all draw on real answers. But a substantial amount of collection has no live consumer at all. Grouped by severity:

**Two entire questionnaires are fully orphaned, both gated behind their own points bonus:**
- **Track Record** (`TrackRecordResponse`, all 19 structured items — largestTeamManaged, budgetOwned, approvalAuthority, pnlAccountability, boardExposure, etc. — the spec's flagship 20-item instrument) — collected on `/dashboard/track-record`, only effect is firing `TRACK_RECORD_COMPLETED` points and syncing an unrelated `isPeopleManager` boolean. None of the 19 answers feed the competency grid, Dossier, Coaching Notes, or Market Reality Report anywhere.
- **What I Need** (`WhatINeedResponse` — 24-item ratings + domain ranking) — collected on `/dashboard/what-i-need`, same pattern: only effect is `WHAT_I_NEED_COMPLETED` points. The schema comment claiming `domainRank` is "the report headline and tie-breaker per spec §4.4" is not implemented anywhere.

**Two more full form sections are orphaned, also gated behind points bonuses:**
- **Red Flags / screening** (`hasRestrictiveCovenant`, `restrictiveCovenantDetails`, `firedForCause`, `willingToTakeDrugTest`, `willingToTakeBackgroundCheck`, `wantsAnimalFriendlyWorkplace`) — collected on `/dashboard/profile/screening`, gates `RED_FLAGS_CONFIRMED`. Despite the schema calling these "real Red Lines for recruiters," nothing in `recruiter-report.ts`, admin candidate detail, or `profile-share.ts` ever surfaces them.
- **Benefits & Compensation Priorities** (9 fields — health/dental/vision, disability insurance, 401k match, PTO weeks, remote days, parental leave, prof-dev reimbursement, commuter benefits, gym) — collected via the Search Strategy page accordion, gates `BENEFITS_PRIORITIES_CONFIRMED`. No scoring/report/matching/admin consumer found.

**Three entire models are dead code — no write path, no read path, or both:**
- `PeerNomination` — zero references anywhere in `src/`, including no submission UI. Pure schema scaffolding.
- `BackgroundCheckConsent` — zero references anywhere. Looks like unbuilt Checkr-integration scaffolding.
- `PivotIdea` (title/description/rationale/rating/ratingReason) — zero references anywhere.

**Fixed:** ~~`CoachingConfidentialDisclosure.disclosureText`~~ — a candidate could submit a confidential disclosure meant for their coach, but only its *existence* was ever checked (to gate onboarding completion); the content was never displayed anywhere, including `CoachingNotesPanel.tsx`. Now surfaced there (commit `586c9c2`) — confirmed via the model/form's own comments that this is flat coach-only visibility on submission, no additional consent gate to respect.

**Confirmed-dead legacy fields (safe to plan a migration around):**
- `jobSearchIntensity` (deprecated slider, already known/documented as replaced)
- `creativityConfidence` — no longer collected (cut from `SkillsAssessmentForm`) and never read
- 7 legacy Reference rating columns (`ratingReliability`, `ratingCommunication`, `ratingTeamLift`, `ratingWorkEthic`, `ratingGrowthMindset`, `ratingConflictNav`, `ratingPositivity`) — the live reference form never writes to them; 2 have zero occurrences anywhere including comments
- `jobBoardUsage`/`jobBoardUsageOther` + 2 support timestamp fields — the collection UI (`JobBoardUsageCheckIn`) was removed and never rebuilt; already has explicit "dead — no reachable UI" comments in the code
- `SupportNetworkContact.category`, `.warmth`, `.schoolName` — never written by `updateContact`, never read

**Collected but doesn't do what it claims:**
- `actionWindow` — candidate sets a preferred daily-email send time on the Privacy page; the only "consumer" is the selector echoing the value back to itself. Zero references anywhere in `src/lib/email/`, `src/lib/daily/`, or `src/app/api/cron/` — it does not actually control anything.
- Three schema comments are simply false: `PerformanceAssessmentResponse.integrityScore` ("read by Coaching/Hiring Manager Notes" — never read), `TrackRecordResponse.accomplishmentToConfirm` ("routes into Reference Check verification" — never read), `WhatINeedResponse.domainRank` (see above).

**Smaller individual orphans** (collected, zero real consumer): `willingToFollowUpOnApplications`, `coachCommunicationStylePreference` (collected on coach-matching form, deliberately excluded from the actual matching query), `managedPeople` (WorkHistoryEntry, not even collected by any form), `resumeFirstJobStartDate`, `streetAddress`, `Reference.verificationConfidence`, `WorkSample.problemStatement`/`.candidateRole`, `InterviewResponse.aiSignalScore`/`.aiSignalNotes`/`.responseFileUrl` (note: `InterviewResponse`'s core fields ARE live-read into the Dossier's Proof Points section — only the collection UI is gone, so no new data flows in, but the read path isn't dead), `LearningBadge.verificationUrl`, `CandidateAssessmentResponse.quadResponses`/`.likertResponses` (raw answers archived, only their one-time-computed derivatives are ever read back), `PerformanceAssessmentResponse.responses` (same pattern), `MarketResponseLog.notes` (not even in the write payload) and `.type` (the write action exists but no UI calls it), `BountyClaim.testimonial` (required at submission, never displayed anywhere), `MemberEmployment.title` (raw value only used as input to derive function/seniority, never itself displayed), `TrackedCalendarEvent.reviewedAt` and `TrackedEmailActivity.reviewedAt` (write-only or entirely unwritten).

**Not orphaned but narrower reach than siblings** (real consumers, just fewer than a same-shaped sibling field — not urgent, just inconsistent): `priorityJobSecurity` (shown to coach, never a matching weight like its 4 siblings), `traitComposureRating`/`.Example` (shown, excluded from competency scoring unlike 4 sibling traits), `compDepartureContext` and Part-C written-response Reference fields (report/coach-only, missing from Dossier), `verifiedCompanyCorrect`/`.correctedCompany` and `verifiedBulletCorrect`/`.correctedBullet` (coach-only, missing from hiring-manager-report unlike sibling verification fields).

## LLM call efficiency audit (completed)

Only 3 real Anthropic call sites exist in this session's diff (`community/moderation.ts`, `companies/intel-moderation.ts`, and a modified `narrative/generate-adaptations.ts`) — all correctly follow the codebase's house patterns: `claude-sonnet-5`, appropriate thinking mode for the task type, reasonably bounded `max_tokens`, no prompt bloat, no accidental duplicate calls, and no unnecessary sequential chains. No code changes were needed. Two of the three, however, are recurring metered-cost calls (one Anthropic call per Community post submitted, one per company-intel submission) that were never explicitly surfaced as a cost driver in code the way comparable features this session were (`resolveCompanyMetadataIfMissing`, `skills-extraction.ts`, `seed_resumes.ts` all have explicit cost-scoping comments) — a communication gap against the standing "flag metered-cost features" practice, not a code defect.

## Design/language/functionality consistency audit (completed)

Checked every new/modified page against `design-principles.md`, retired terminology ("Hireability," "Success Sprint," "The Circle," raw `/100` scores), and reuse of established shared patterns (SubmitButton, pagination, Accordion, skeleton/Suspense fallbacks, PageHeaderBoxes). Fixed (commit `8ca7511`): two hand-rolled busy-buttons replaced with the shared `SubmitButton` component (admin population snapshot generator, Community post composer), and the admin Companies list — the one admin list in the whole session that fetched every row with no `take` limit and no pagination UI, unlike every sibling admin list — now uses the same shared pagination helper as the rest of admin. Terminology greps came back clean (only false positives: the real "HireAbility" ATS vendor name, and intentionally-preserved old Postgres column names behind `@@map`). A few borderline calls (5-button groups where a dropdown couldn't preview color swatches, a 5-choice filter reset) were left as defensible exceptions rather than force-fit into the design-principles threshold.

One cosmetic-only item was out of scope for an inline fix (renaming `SuccessSprintCard.tsx`'s file/component name to match its own already-correct "Weekly Search Sprint" rendered title touches ~13 importers) — spun off as its own follow-up rather than bundled into this audit.

## Non-goals confirmed correct (not gaps — verified working as intended)

- References are required for everyone regardless of Confidential Search Mode — audited, no softening found.
- Turning Confidential Search Mode back on is immediate/one-tap/no-confirmation — audited, correct.
- The dossier-competencies +5 "visibility bonus" no longer penalizes confidential-mode candidates for a reason unrelated to real connecting activity — fixed and verified against real data.
- A real current-employer leak on the public reference-submission page (`/ref/[token]`) was found and fixed during this session — a confidential-mode candidate's current employer could previously be exposed to their own reference under certain conditions.
