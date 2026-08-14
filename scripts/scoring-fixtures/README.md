# Scoring release-gate fixtures

Fixture data for the release gates in `docs/specs/NextChapter_PHASE2_MASTER_SCRIPT.md`
§16, run by `src/test/scoring-fixtures.test.ts`. Every fixture is a
hand-authored `ResumeAnalysisFacts` object (see
`src/lib/scoring/resume-analysis/extract-facts.ts`) exercised against the
real, pure, DB-free layer of the new five-component scoring system
(`src/lib/scoring/resume-analysis/`, `src/lib/scoring/market-reality/`) —
`computeAllDimensions`, `computeReconciliation`, `computeExtracurricular`,
`selfCheckResumeAnalysis`, `simulateAtsCompatibility`, and the general
narrative self-check in `src/lib/scoring/self-check.ts`. Nothing here calls
the legacy six-category `computeDossierCompetencies` grade — that system is
still live in production routes today, but §16's gates describe the new
five-component system, not the old one.

## Candidates

- **kwan.ts** — strong executive candidate, elite institution + prestige
  employer, a real EVP → President scope increase.
- **solano.ts** — Kwan's twin minus prestige: a deep clone of `kwanFacts`
  with only institution/employer names changed, so every dimension score,
  the reconciliation penalty, the extracurricular bonus, and `experienceScore`
  come out bit-for-bit identical. Only `resumeScore` may legitimately
  diverge, because prestige is a Resume-only modifier.
- **hollander.ts** / **danforth.ts** — the function-fairness pair (gate 8):
  an engineering VP with zero revenue/dollar metrics vs. a sales VP with
  real dollar metrics, bullet-for-bullet matched on quantification shape
  (every bullet a from/to pair) so `scoreQuantification` comes out
  identical between them.
- **whitcomb.ts** — early-career, one-page, thin extracurricular content,
  with exactly three real, fixable issues (an activity-not-outcome bullet,
  no stated target, one typo). `whitcombFixedFacts` in the same file applies
  exactly those three fixes and nothing else — used by gate 7.
- **kwan-ats-broken.ts** / **kwan-unquantified.ts** — Kwan variants for gate
  14 (component separation): identical `roles[]`/scope facts, but with
  hard-failure `atsFlags` in one case and stripped bullet numbers in the
  other.

## Gates covered here (§16)

1 (ordering), 2 (logo isolation), 3 (prestige cap), 4 (scope over title),
5 (self-check), 7 (movement is real — release blocker), 8 (function
fairness), 9 (band fairness), 14 (component separation), plus a narrowly
scoped version of 6 (narrative alignment) and 19 (low-band tone) against the
deterministic, zero-LLM template tables in
`src/lib/reports/market-reality-sections.ts` and
`src/lib/scoring/market-reality/narrative.ts`, and a bonus check for gate 18
(every `Finding` has a non-empty `fix`).

## Gates explicitly NOT covered here, and why

**Needs real DB-backed test infrastructure this repo doesn't have (10, 12, 13):**
Gates 10 ("unmeasured never grades"), 12 ("measured-only composite"), and 13
("market cap") all need real `CandidateProfile`/`Reference`/
`MarketRealityComponentScore` rows — that's the DB-backed
`market-reality/composite.ts` layer, not the pure resume-analysis layer this
harness exercises. This repo has no test-database infrastructure (no
`DATABASE_URL` is loaded for `vitest`, and there's no existing precedent for
integration-testing against Prisma in `src/test/`). Standing that up is a
separate, real scoping decision — not something to improvise inside a
fixture harness.

**UI-only, not a scoring-output assertion (11):**
Gate 11 ("no sibling rendering") asserts something about component
rendering hierarchy in the UI, not about any computed number. A data-layer
fixture harness has no way to assert it — this needs a component/rendering
test, not a fixture.

**The underlying scoring behavior doesn't exist in the engine yet (15, 16, 17):**
Gates 15 (gap scoring), 16 (interim resets the clock), and 17 (volume is not
effort) all describe scoring logic that was never built:
- No gap-duration input reaches `experienceScore` anywhere in
  `src/lib/scoring/resume-analysis/dimensions.ts`.
- Interim/fractional work only ever bonuses Effort
  (`src/lib/scoring/market-reality/effort.ts`); nothing resets or restores
  Your Experience's duration read.
- The applications leg of Effort is a flat saturating count with no
  interview/conversion signal at all — there is no "volume vs. strategy"
  split to test.

Writing a test for behavior that isn't built produces a permanently-red
test for the wrong reason, not a signal. These three are blocked on a real
scoring-engine feature, not on missing test coverage — code comments in
`dimensions.ts` and elsewhere cite a "§3.1-§3.9" that isn't present in the
currently-committed master script, so building this now would mean
inventing scoring rules from nothing.

Gate 18 ("every penalty has a route") is *partially* covered: every
`Finding` produced by the fixtures here is asserted to have a non-empty
`fix` string, which is close to true-by-construction given `Finding`'s TS
type. The "strategy penalty" half of gate 18 depends on the same
not-yet-built Effort/Strategy split as gate 17, so it isn't covered.
