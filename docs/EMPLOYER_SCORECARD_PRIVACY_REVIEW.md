# Employer outcome scorecard: privacy review

Status: **design review and implementation notes, written 2026-10-13. Not signed off.** The feature ships **off** (`EMPLOYER_OUTCOMES_SCORECARD_ENABLED` unset) and must not be enabled for any real employer until the sign-off checklist at the end is complete. This document was written by the engineer-assistant who built the feature; it is a self-review and a map for the human reviewer, not a substitute for one.

## 1. What it is
A cohort-level card on `/employer/reporting` showing, for the people in one outplacement contract who **chose to share**, how many found permanent work compared with what is typical for people at the same stage of a search. Output: group labels, people counts (rounded), "found work" counts (rounded), and a coarse comparison band (below / about / above / well above what is typical). Nothing else.

Code: `src/lib/employer/outcome-scorecard.ts` (pure logic), `outcome-scorecard-server.ts` (reader, flag), `prisma/sql/employer-outcomes.sql` (aggregate function), `src/components/employer/OutcomeScorecardCard.tsx`, candidate consent in `src/app/dashboard/got-hired/sharing-actions.ts`.

## 2. Requirements this must meet (Partners Master Build Script)
| Requirement | How it is met |
|---|---|
| A1.2.2 No org-side query joins candidate data; aggregates from structures that cannot resolve to a person | The reader's only database call is `private.employer_outcomes_by_bucket`, which returns at most five rows of counts. No candidate, seat, hire or org-user row is read by employer code (enforced by a structural test). The function lives in the `private` schema with all API roles revoked. |
| A1.2.3 An org user can never tell whether anyone has a candidate account | Counts include only people who opted in; non-consenting, non-account and consenting people are indistinguishable from each other in the output. See residual risk R2 (opt-in count vs seat count). |
| A1.2.4 A candidate who is also an org user never sees their own record from the org side | People whose login is a user of the same employer organization are removed from numerator and denominator in SQL, silently. Residual risk R5 (different logins). |
| A1.3 Minimum cell size 10 | Whole card suppressed under 10 people; buckets **merged** until every shown group has at least 10, so a small cell cannot be recovered by subtraction. |
| A1.3 Round to nearest 5 (spec: below 50 seats) | **Stricter:** always round to nearest 5. |
| A1.3 / A7 Cohorts under 20 seats report quarterly | **Stricter:** every cohort is snapped to the last complete quarter (`as of` boundary passed to SQL; nothing after it is counted). |
| A1.3 Suppress any metric that could isolate a single member | No cross-tabs (never by function, level, pay, source or hire type). Band withheld when fewer than 5 re-employments are expected, so one person cannot flip it. |
| A7 Never any individual in any form; a confidential-mode member never surfaces | Confidential Search Mode members are excluded in SQL, from numerator and denominator. No names, ids, dates, pay or sources reach the output. |
| E3.9 No placement success claims without substantiating data | Card states it is self-selected and observational. Interim and fractional work is not counted as a permanent hire. Comparisons use only verified benchmarks (low-confidence rows are ignored). |

## 3. Threat model
Adversaries: (a) an employer admin or viewer; (b) an HR colleague who is also a job seeker; (c) anyone who sees reports over time; (d) a malicious org user with a SQL or API path.

| # | Threat | Mitigation | Residual |
|---|---|---|---|
| T1 | Differencing between reports reveals one person opted in/out, found work, or entered Confidential Search Mode | Quarterly snapping for all cohorts, rounding to 5, coarse bands | R3 |
| T2 | Subtracting visible small cells from a shown total | Merging until each shown group has at least 10; total shown only if at least 10 | none known |
| T3 | A small cell reveals one person | Suppression under 10, merging, band withheld under 5 expected events | R1 |
| T4 | Employer links the roster (who was laid off when) to the buckets | Employer already knows layoff dates, so buckets alone reveal little; cell size and rounding limit inference | R1 |
| T5 | Org user also a candidate sees themselves | Removed in SQL by login match | R5 |
| T6 | Confidential-mode state leaks through a count drop | Excluded in SQL; rounding and quarterly snapping hide a single change | R3 |
| T7 | Direct data access from the employer session | `private` schema, API roles revoked; reader calls one function; structural tests forbid other access | R6 |
| T8 | Scorecard used to infer consent decisions | Consent state is visible only to the candidate; card shows counts of people included, never opt-in rate | R2 |
| T9 | Self-reported hire data is false or biased | Disclosed as self-selected and self-reported; not used for any claim | R4 |

## 4. Residual risks (honest list)
- **R1: employer knowledge of its own layoffs.** An employer that knows exactly who left when, and that a cohort is small, may narrow candidates. Mitigated by cell size 10, merging and rounding, not eliminated. Consider a higher minimum (for example 20) for contracts under 50 seats.
- **R2: opt-in count vs seat count.** The card shows "about N people included"; other cards show activated seats. The gap hints at the opt-in rate. Mitigation: rounding. Option: stop showing the included count and show only bands.
- **R3: boundary crossings.** Rounding and quarterly snapping reduce but do not remove differencing when a change crosses a rounding boundary.
- **R4: data quality.** Hires are self-reported by those who chose to share and to report. The comparison is association, not causation.
- **R5: login matching.** Exclusion matches the candidate's login to org users of the same org. A person using a different login (for example a personal email) for the portal is not matched.
- **R6: operational.** Anyone with database owner access, or a mistaken future change, could bypass the structure. The structural tests catch common mistakes but are not a control against a privileged insider.
- **R7: consent wording.** The candidate-facing text has not had legal review.

## 5. Verification done
- SQL function checked on a local Postgres 16 with hand-computed fixtures: a non-consenting seat, a Confidential Search Mode member, and a candidate who is also an org user all contribute nothing; interim-only hires are not counted as permanent; the as-of boundary excludes later events.
- 14 unit tests (`src/test/employer-scorecard.test.ts`): suppression, merging, rounding, bands, quarterly snapping, output carries no identifying keys, the reader touches no candidate/seat/hire/org-user table and issues exactly one raw query, the SQL keeps every exclusion, the flag is off by default.
- Not done: adversarial differencing exercise on realistic data, load testing, legal review, review against production RLS.

## 6. Rollout
1. Merge with the flag **off**. Apply `prisma db push`, then `npm run he:rls` (it now applies `employer-outcomes.sql`).
2. Staging: synthetic cohorts of 12, 25, 60 and 200 seats; run a red-team differencing exercise (two consecutive quarters, one person changing state at a time) and record results.
3. Counsel reviews the candidate consent copy (`EmployerOutcomeSharingCard`) and the employer-facing disclosure.
4. Raise the benchmark confidence only after verifying sources, otherwise the card shows no comparison.
5. Enable per organization (a per-org allowlist would be a small follow-up) and monitor.

## 7. Sign-off checklist (human reviewer)
- [ ] Privacy lead or counsel has reviewed this document and R1 to R7.
- [ ] Decision on R1 (minimum cell size for small contracts) and R2 (show included count or bands only).
- [ ] Red-team differencing exercise completed and recorded.
- [ ] Consent copy approved; revocation behavior accepted (applies from the next quarterly report).
- [ ] Benchmarks verified and confidence raised in `DurationBenchmark`.
- [ ] Contract language with employers updated to describe anonymous, opt-in outcome counts.
- [ ] Decision recorded: enable flag for which organizations.
