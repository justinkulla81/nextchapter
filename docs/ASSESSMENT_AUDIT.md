# Assessment Layer — Pre-Build Audit

Run before any implementation of the "Assessment Layer" spec (Skills & Behavioral
Assessments · Reference Check · Report Redesign, v1.0), per that spec's own
Part 0 instructions: audit first, ask questions, no code until reviewed.

Findings are grouped to match spec §7. Every claim below is sourced from direct
repo/DB investigation, not from re-reading the spec. Where the spec's factual
premise turned out to be wrong, that's called out explicitly — the spec was
written without repo access and says to expect that.

---

## 1. Structured-input route inventory

### 1a. Skills Inventory (`/dashboard/skills-assessment`)

Full duplicate of onboarding's Experience step (`ExperienceForm.tsx`) — same
labels, same field names, copy-pasted components, not shared. **This is a real
duplicate the spec never mentioned.**

| Question | Field | Consumers |
|---|---|---|
| Top 3 strengths (multi-select, max 3) | `CandidateProfile.topStrengths String[]` | Dossier alignment callout, self-awareness mismatch checks, hireability-grade self-awareness inputs, Hireability Report LLM prompt, "How I Operate" dossier section, hireability-report email |
| Have you been a people manager? | `isPeopleManager Boolean?` | Leadership category confidence + score, self-awareness checks, job-fit matching, learning plan, job-fit-bucket |
| Largest team managed | `teamSizeManaged Int?` | Leadership score, learning plan, Hireability Report LLM prompt, resume-analysis LLM prompt |
| Core function confidence (slider) | `functionSkillConfidence Int?` | Skills & Execution category confidence + base score (blended 50/50 with reference `overallRating` when present) |
| AI skills confidence (slider) | `aiFlexibilityLevel Int?` | Learning-plan course-tier default, skill-gap LLM prompt, **confirmed penalty-only**: −10 at ≤25, −5 at ≤50, never a bonus (`hireability-grade.ts:345-357`) |
| Management confidence (slider, gated) | `managementSkillConfidence Int?` | Leadership score (0.3 weight), self-awareness checks, Hireability Report LLM prompt |
| "How action-oriented are you?" | `actionOrientedConfidence Int?` | Ownership & Reliability category confidence + score (blended 50/50 w/ reference `traitFollowThroughRating`) — **spec's cut is fine, field is a real duplicate of Velocity/Commitment/Execution as claimed** |
| "How creative are you?" | `creativityConfidence Int?` | **Confirmed single-consumer**: one line of narrative color in the Hireability Report LLM prompt (`hireability-report.ts:321`) and nowhere else. Spec's cut is accurate and safe. |
| "How strong a communicator are you?" | `communicatorConfidence Int?` | Communication category confidence + score (blended 60/40 w/ resume ATS score, then 50/50 w/ reference `traitCollaborationRating`), self-awareness checks |

**Track Record module does not exist anywhere in the codebase today** (no
scope/budget/board-exposure/org-size/sector-history fields on any model). Building
it is net-new work, not a consolidation of scattered existing fields as the spec's
framing might suggest.

### 1b. Career Goals / Search Strategy / Profile duplicates (spec §6.1)

**No standalone "Career Goals" route exists.** Zero hits for "Career Goals" /
"career-goals" anywhere in the repo. The spec's "Career Goals" = onboarding's
`src/app/onboarding/goals/page.tsx` (`GoalsForm.tsx`) — it has always been an
onboarding step, never a separate page. "Search Strategy" =
`src/app/dashboard/search-strategy/page.tsx`.

**The critical finding: for 8 of the spec's 9 claimed duplicates, both forms
already write to the same single `CandidateProfile` column — there's no
divergent data to reconcile, and the duplication is documented as deliberate**,
per commit `9817a7c` ("Search Strategy overhaul: duplicate Hireability
Assessment fields... Search Strategy page now surfaces (and lets you edit) the
same company-size/type, comp flexibility, equity, willing-to-start-lower, and
other-considerations questions asked in the Hireability Assessment's Goals
step, **in addition to keeping them there**"). This matches a decision already
made and re-confirmed in this project's own session history (task: "Restore
target role/industry/company-size/location to onboarding Goals (keep in Search
Strategy too)").

| Claimed duplicate | Field | Verdict |
|---|---|---|
| Target industries | `targetIndustries String[]` | Real, same column, **deliberate** (commit 9817a7c) |
| Target role / "I'm flexible" | `targetRoleType String?` | Real, same column, **deliberate** |
| Pivoting checkbox | `isPivoting Boolean` | Real, same column, word-for-word identical label, **deliberate** |
| Target company size | `targetCompanySize String?` | Real, same column, **deliberate** |
| Target company type/stage | `targetCompanyStage String?` | Real, same column, **deliberate** |
| Location preference | `remotePreference String?` | Real, same column, **deliberate** |
| Comp flexibility | `compFlexible Boolean` | Real, same column, **deliberate** |
| Willing to start lower | `willingToStartLower Boolean` | Real, same column, **deliberate** |
| Open to relocating | `openToRelocation Boolean` | Real, but **2-way not 3-way** — spec's claim of a Profile-page copy is false. **Deliberate** 2-way dup. |
| Job function ("background function" / "primary job function" / "primary function") | `primaryFunction String?` | **Genuinely 3-way, no documented rationale.** Asked on Goals, Search Strategy, AND Profile's `FunctionConfirmForm`, three separate server actions writing the same column. Best actual consolidation candidate. |
| Screening questions (drug test/background check/non-compete/pet-friendly) | — | **Spec claim is false.** Only one location: `/dashboard/profile/screening`. The Profile hub links to it, doesn't re-render it. |
| Seniority | `highestLevelReached` / `yearsExperience` / `resumeLatestJobTitle` | **Spec claim is false.** These are three complementary fields (asked in different places, never overlapping), not a duplicate — merging would be a real, and wrong, data-model change. |

**Implication**: merging items 1–9 per the spec would revert a deliberate
product decision (and falsify Search Strategy's "editable any time your
situation changes" copy). Item 10 (`primaryFunction`) is the one field worth
actually consolidating. Items 11–12 have no duplicate to fix.

### 1c. References feature (currently misdescribed by the spec as "a checkbox")

**This is the single most important correction in the audit.** The spec's §5
(Reference Check rebuild) and §6.4 ("this code path either reads nothing,
reads a stub...") both assume the reference system is a checkbox producing no
ratings. It is not. It is a fully-built, already-live scoring pipeline:

**`Reference` model** (`prisma/schema.prisma:1214-1301`) — already has:
- 7 legacy 1-5 behavioral ratings (reliability, communication, conflict nav, team lift, work ethic, growth mindset, positivity) + overall rating
- **9 BARS (behavioral-anchor) dimension ratings**, one per assessment dimension (`barsVelocity`, `barsArchitecture`, `barsStructure`, `barsCommunication`, `barsEnvironment`, `barsLeadership`, `barsOversight`, `barsCommitment`, `barsConscientiousness`), rendered via anchor-text radio choices sourced from `BARSAnchor` rows
- 5 trait ratings with required example text each (Adaptability, Follow-Through, Presence, Collaboration, Composure)
- 4 open-ended narrative fields (superpower, under-pressure story, defining story, would-work-with-again reason) feeding a candidate-approved `ReferenceQuote` pipeline
- Would-hire-again, dispute flow, relationship type + verification, `quotableWithAttribution` consent flag

**Two live submission entry points**: candidate-invited (`/ref/[token]`) and
employer-initiated (`/for-managers/give-a-reference` → claimed via
`/claim-reference/[token]`) — both funnel into the same scoring pipeline.

**Scoring is already wired**: `src/lib/scoring/reference-delta.ts` averages
`(score-3)/2` across completed, BARS-scored references per dimension, diffs
against the candidate's self-reported `dimensionVectors`, flags "friction
surfaces" above a `0.8` threshold, and persists both onto
`CandidateAssessmentResponse.referenceDelta`/`.frictionSurfaces` on every
reference completion/claim.

**`src/lib/reports/hiring-manager-report.ts` already reads this live data**,
not a stub, to produce a real "self vs. reference friction examples" list
(candidate's self-described anchor text vs. the reference-aggregated anchor
text, per dimension) and a real self-awareness score/label
(High ≥75 / Moderate ≥50 / Low <50, from `100 * (1 - avg_delta/2.0)`). This is
already rendered on the recruiter-facing candidate search page
(`src/app/recruiters/(app)/search/[candidateId]/page.tsx:119-144`).

**Note**: there's a second, unrelated "self-awareness" mechanism
(`src/lib/scoring/self-awareness.ts`) that compares the candidate's onboarding
answers to their own later in-app behavior — used internally for the
Dossier/Coaching Notes. Don't conflate it with the reference-derived one above;
they produce differently-scoped labels for different audiences.

**Implication**: building the spec's Reference Check module means migrating an
existing working system, not building one from scratch. A from-scratch build
run in parallel would either duplicate the pipeline or silently orphan the 9
BARS columns and break the recruiter-facing report that already depends on
them.

---

## 2. Working Style ("How I Work Best")

**Schema** (`prisma/schema.prisma:1430-1500`, explicitly flagged in a comment
as "First-pass, unvalidated instrument"): `QuadBlock` → `QuadBlockStatement`
(1:many), standalone `LikertItem`, `CandidateAssessmentResponse` (stores
`quadResponses`/`likertResponses` as JSON blobs keyed by bare-string
`blockId`/`itemId` — **not FK-enforced**), `BARSAnchor`.

**rotationGroup**: only two values exist in the DB, 1 and 2.
`CURRENT_ASSESSMENT_ROTATION_GROUP = 2` (`src/lib/constants/onboarding.ts:207`)
is what the app actually serves.

| rotationGroup | QuadBlocks | Statements | Dimensions | LikertItems | Candidates completed |
|---|---|---|---|---|---|
| 1 | 10 | 40 | 8 (no `conscientiousness`) | 12 | **0** |
| 2 (live) | 12 | 48 | 9 | 16 | **1** |

**There is exactly one completed assessment response in all of production**,
and it's entirely self-contained within rotationGroup 2 (references only
rotationGroup-2 blocks/items on both the quad and Likert side). RotationGroup 1
is fully orphaned — zero responses reference it, safe to drop outright.

**Item text differs completely between groups** — not a rewording pass, a
wholesale independent regeneration (different phrasing style per group, no
shared item text).

**Dimension names in the DB** (rotationGroup 2, confirmed both tables): `velocity,
architecture, structure, communication, environment, leadership, oversight,
commitment, conscientiousness` — 9 total. **The spec's rename table only
covers 6 of these** (Conscientiousness→Rigor, Leadership→Directness,
Architecture+Structure→Definition, Communication+Environment→Collaboration) —
it omits Velocity, Oversight, and Commitment, which exist and need explicit
handling (kept as-is? renamed too?) in any 9→7 merge plan.

**Seed script** (`scripts/seed-assessment-content.ts`) confirmed to call the
Anthropic API live at seed time — item text is not static in the repo, exactly
as the spec claims. The rotation mechanism is already a working, intentional
pattern (re-runs insert under a new `rotationGroup`, never collide with the
live one) — expanding to 56 Likert items is a `LIKERT_ITEM_COUNT` constant
change + reseed under a new rotationGroup, not new architecture.

**Data-safety flag**: `quadResponses`/`likertResponses` reference
`blockId`/`itemId` as plain JSON strings with no DB-level foreign key —
nothing stops a migration from deleting/renumbering rows those blobs point at.
Blast radius today is exactly one response row, but worth an explicit
check-before-delete step regardless.

---

## 3. Market Reality confidence tiers

**Labels**: `PROVISIONAL` / `BUILDING` / `HIGH` internally
(`src/lib/scoring/grade.ts:155-176`) — **candidate-facing, the HIGH tier
displays as "Confirmed", not "High"**. Worth knowing before writing new
copy that says "High."

**6 category names confirmed correct** (`grade.ts:98-105`): Target Fit,
Leadership & Management, Skills & Execution, Communication & Collaboration,
Adaptability & Change Readiness, Ownership & Reliability.

**Tier logic** (`hireability-grade.ts:213-233`, `getCategoryConfidence`) is a
hardcoded `switch` on category — reference count is only ever checked as a
binary gate (`refCount >= 1`), never graduated. **Not reusable as-is** for the
spec's proposed 1-2/3-4/5+ reference-count tier system; would need extraction
into a new pure helper (e.g. `referenceCountToTier(count)`), not a drop-in
reuse. The `ConfidenceLevel` enum/labels themselves are reusable.

---

## 4. Duplicates / Orphans / Dead ends / Broken dependencies

**DUPLICATES** (beyond §1a/1b above): none additional found.

**ORPHANS**:
- `creativityConfidence` — confirmed single-consumer (narrative color only), spec's claim accurate.
- `unlockAction` guidance text (`grade.ts` `CATEGORY_UNLOCK_ACTION`/`SELF_AWARENESS_UNLOCK_ACTION`, computed in `self-awareness.ts`) is set on `CategoryGrade.selfAwareness` but **no `.tsx` file anywhere reads it** — dead/unsurfaced guidance copy. Not mentioned in the spec; worth a decision (wire it up or delete it) during the refactor.

**DEAD ENDS**:
- References feature UI entry points (nav, Portfolio, Contact Directory, action-plan item) — all functional, none broken.
- Executive Coach waitlist — has a proper terminal confirmation state, not a dead end.
- `src/app/dashboard/retake-assessment/page.tsx` has **no link back** to `/dashboard/skills-assessments` (its sibling `skills-assessment` page does have one). Minor UX dead end — a candidate who lands there without submitting has no in-page way back.
- No feature gate found referencing a field that's provably never set.
- `LockedFeatureNotice.tsx` has a stale doc comment referencing a "Search Action Grade" that no longer exists post-Scoring-Model-2.0 (terminology drift only, not a functional bug — flagging since the spec explicitly asks to check for grade-name mismatches).

**BROKEN DEPENDENCIES**: none found — the Hiring Manager Report → reference
data dependency (§1c above) is real and working, not broken; it was only
misdescribed by the spec as broken/stubbed.

**One product-level tension found, not a bug**: the $500 Offer Bonus claim
(`/dashboard/got-hired`) is gated on `currentGrade === 'A'` — reachable but
rare by design (grading is deliberately hard-curved so "most candidates land
on C"). A candidate who already got hired must still be scoring in the
top tier of an *ongoing job search* metric to collect the bonus they earned by
no longer needing one. Unrelated to the assessment spec, but adjacent enough
(same grading system the spec's confidence tiers build on) to flag now.

---

## 5. Founder questions

Per spec §0.1, these are the points where I should not guess:

1. **Reference Check (§5 of the spec) — rebuild or migrate?** The current
   `Reference` model already has 9 BARS ratings, 5 trait ratings, quote
   approval, and a live delta/friction pipeline feeding the recruiter-facing
   Hiring Manager Report. The spec's Part A/B/C/D structure (12 parallel
   performance items, 5 comparative items, 2 rotating written questions,
   verification) is different in shape from what exists. Do you want:
   (a) migrate the existing BARS/trait data into the new shape and cut over,
   (b) extend the existing system with the new pieces it's missing (comparative
   panel, rotating written questions, confidence-tier display) without
   replacing the BARS/trait layer, or (c) something else? This determines
   almost the entire Phase 2 plan.

2. **Career Goals / Search Strategy fields — keep the deliberate duplication?**
   8 of the spec's 9 claimed dedup targets are a documented, deliberate design
   decision (commit 9817a7c, re-confirmed in this project's history). Should I
   leave them as-is, or has that decision changed? The one field worth
   actually consolidating is `primaryFunction` (3 undocumented copies:
   Goals, Search Strategy, Profile) — okay to merge that one?

3. **How I Work Best dimension merge — Velocity, Oversight, Commitment.** The
   DB has 9 live dimensions; the spec's rename/merge table only accounts for
   6. Should Velocity, Oversight, and Commitment carry over unchanged into the
   new 7-dimension set (as the spec's §2.2 final list implies, since it lists
   Velocity/Oversight/Commitment alongside the renamed/merged ones), or does
   something else need to happen to them? (My read: they're unchanged and the
   spec's §6.4 rename table is just incomplete, not wrong — confirming before
   I build the migration either way.)

4. **rotationGroup 1 — hard delete okay?** Zero candidate responses reference
   it. Spec's rule is "soft-delete only, no hard deletes anywhere" — does that
   still apply to content rows nobody ever answered, or is a hard delete fine
   here since there's no candidate data to protect?

5. **The one existing candidate response (rotationGroup 2, 16 Likert items, 12
   quad blocks).** The spec wants quad-blocks cut entirely and Likert items
   expanded to 56 under a frozen, version-controlled bank (replacing the
   Anthropic-live-generation pattern). That candidate's existing answers won't
   map onto the new bank. Archive-in-place (keep the row, mark it
   superseded, never show it in new comparisons) — is that the right handling,
   or did you have something else in mind for the one real response that
   exists today?

6. **Skills Assessment duplicate with onboarding Experience.** Not something
   the spec flagged, but it's real: every Skills Assessment question is asked
   twice, verbatim, via two separate copy-pasted forms. Worth fixing as part
   of this build (share one component, one canonical route) even though it's
   outside the spec's explicit scope?

7. **Confidence-tier reuse for Reference Check.** The existing
   Provisional/Building/Confirmed tier logic is a hardcoded switch, not a
   reusable function — building the spec's reference-count-based tier (1-2 /
   3-4 / 5+) means extracting a new shared helper. Fine to build that as new
   code alongside the existing switch, or do you want the existing category
   tiers refactored to use the same helper while I'm in there?

8. **`unlockAction` dead code.** Computed, never rendered anywhere in the app.
   Wire it up somewhere in this refactor, or delete it as unused?

9. **HIGH tier displays as "Confirmed" candidate-facing.** The spec's copy
   throughout (§5.8, §9.3) says "High" — should new candidate-facing copy
   match the existing "Confirmed" label for consistency, or is "High" the
   intended new wording (in which case the existing tier's display label
   should probably change too, for consistency across the whole confidence-tier
   system)?

Not proceeding to Phase 1 until these are resolved.

---

## 6. Decisions (approved by founder 2026-08-11 — do not re-litigate)

1. **Reference Check**: extend the existing BARS/trait/delta pipeline, don't replace it. The new Part A-D content is additive alongside the existing style-friction system.
2. **Goals/Search Strategy duplication**: left as-is (8 fields). Only `primaryFunction`'s 3rd copy (Profile's `FunctionConfirmForm`) is a real consolidation target — not yet done.
3. **Velocity/Oversight/Commitment**: carry over unchanged into the new 7-dimension Working Style set.
4. **rotationGroup 1**: safe to hard-delete (zero candidate responses reference it) — not yet done.
5. **The one existing candidate assessment response**: archive in place when the item bank changes, don't force-migrate — not yet done.
6. **Skills Assessment / onboarding Experience duplicate**: worth fixing as part of this build — not yet done.
7. **Confidence-tier reuse**: built `referenceCountToTier` as a new shared helper (`src/lib/references/reference-count-tier.ts`) rather than folding into the existing hardcoded switch; existing category tiers left untouched for now.
8. **`unlockAction` dead code**: not yet wired up.
9. **"Confirmed" vs "High"**: standardized on "Confirmed" — new Reference Check UI reuses `ConfidenceLevel`/`CONFIDENCE_LABEL` from `grade.ts` directly rather than inventing new copy.

## 7. Build log

**Phase 1 (schema) + Phase 2 (Reference Check, partial) — 2026-08-11:**
- Schema: 5 new enums (`RelativeRank`, `HireAgainLevel`, `DepartureContext`, `TakeAgainLevel`, `TrustedScopeLevel`) + `Reference` model extended with Part A (12 performance ratings), Part B (5 comparative fields), Part C (written-question assignment + 2 responses), Part D (verification), `inviteSequence`. Pushed to production DB via `prisma db push`, `prisma generate` run.
- `src/lib/references/written-question-pool.ts` — Part C rotating-question assignment logic (pure function).
- `src/lib/references/anchored-scale.ts` — the 1-4 anchored scale + equal-weight UI rule documentation.
- `src/lib/references/reference-count-tier.ts` — Part 5.8 confidence tier (1-2/3-4/5+ → Provisional/Building/Confirmed).
- `src/lib/references/parse-reference-form.ts` — extended with `parseReferenceCheckExtension` for the new fields.
- `src/app/dashboard/references/actions.ts` — `requestReference` now assigns `inviteSequence` + written questions at invite time.
- `src/app/ref/[token]/actions.ts`, `src/app/ref/[token]/page.tsx` — wired the new fields into the submission flow.
- `src/components/references/ReferencePerformanceScale.tsx` (new), `src/components/references/ReferenceSubmissionForm.tsx` (extended) — Part A-D UI, anchored equal-weight scale, manager-conditional Part B/C questions, Part D verification.
- Verified: `prisma validate`, `tsc --noEmit`, `eslint` (all touched files, 0 warnings), isolated `next build` — all clean.

**Not yet built** (remaining from Phase 2, plus Phases 3-10 entirely — see spec §11 build order):
- Required reference-mix validation/status UI (≥1 manager, ≥1 peer, ≥1 report-or-client) on the candidate-facing references page.
- Aggregation display (Part A/B means → anchor labels, confidence tier, spread — spec §5.8) on the candidate references page.
- Phase 3: Hiring Manager Notes redesign (the letter-format one-pager, §9.1) — needs to read the new Part A/B/C/D data.
- Phase 4: How I Perform module (new, 40-item self-report).
- Phase 5: How I Work Best rebuild (frozen 56-item bank, quad-block warehousing, dimension merge/rename).
- Phase 6: Assessments hub page + remaining dedup (Skills/Experience, `primaryFunction`) + dead-end fixes (`retake-assessment` back-link, `unlockAction`, `LockedFeatureNotice` stale comment).
- Phase 7: Executive Dossier redesign.
- Phase 8: Market Reality redesign (sparklines, confidence-tier unlock mechanic).
- Phase 9: Track Record, Work Interests (O*NET), What I Need modules — all net-new.
- Phase 10: Coaching Notes additions.
