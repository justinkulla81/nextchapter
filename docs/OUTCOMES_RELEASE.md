# Outcomes release (branch `outcomes-release-nc`)

What this release adds, how to deploy it, and what is deliberately not built. Written 2026-10-13.

## Principles
- The north star is the existing **Dossier** (work done: references, assessments, outreach, applications, skills). Nothing here replaces it.
- Raw time-to-offer is **not** a headline metric (adverse selection and stigma). Outcomes are reported **within the same unemployment-duration bucket**, as duration-adjusted re-employment uplift, with pay retention and level retained as guardrails. Always observational, never causal.
- Cold applications are never capped or blocked. A soft, dismissible nudge encourages introductions.
- No candidate is ever labelled or scored by these features. Age is optional and self-reported, never inferred.
- Where there is no sourced benchmark the UI says so instead of showing a number.

## Deploy order (important)
1. `prisma db push` against **staging first**. New columns on `CandidateProfile` (`lastJobEndedAt`, `ageBand`) mean every query that reads a profile fails until this runs, so do **not** deploy the code before the schema.
2. `npm run he:rls` (re-creates the consent-applying views, including `private.v_outcomes_by_bucket`).
3. `npm run seed:outcome-benchmarks` (seeds the starter benchmarks, flagged `isSampleData`).
4. Verify the seeded benchmarks against the original sources (BLS, Federal Reserve, NBER were not reachable when compiled) before showing outcome numbers to a college.

## What was built
| Area | Where |
|---|---|
| Duration buckets, uplift, pay retention, small cells, search-mix nudge, pay-change estimate, runway, segments | `src/lib/outcomes/` (unit-tested in `src/test/outcomes.test.ts`) |
| Hire capture (last day worked, how a hire came together, optional pay and level), age range | `/dashboard/got-hired` |
| Referral-first nudge and segment guidance | `/dashboard/network` |
| Master's/MBA guardrail, pay-change ranges | `/dashboard/learning` |
| Runway (state UI facts + local savings cushion) | `/dashboard/benefits` |
| AI-workflow work sample type with before/after | `/dashboard/work-samples` |
| Career Services Outcomes tab (consent-applied, small cells hidden, benchmark-pending states) | `/i/[slug]/career/outcomes`, `prisma/sql/higher-ed-views.sql` |
| Alumni mentors (opt in, browse, request, accept, complete) | `/i/[slug]/candidate/mentors` (HE-09 core) |

## Not built, on purpose
- **Employer / outplacement duration-adjusted scorecard.** The employer reporting layer has a strict privacy guard (minimum cell size, rounding, quarterly snapping for small cohorts, no candidate ids). A duration-adjusted view needs a deliberate privacy review against that guard first.
- Fractional/interim logging already existed on `/dashboard/interim-work`, so nothing was added.
- Staff-side mentor views (Alumni Relations Mentors tab), mentor matching beyond tag search, and engagement point weights (placeholders; align with spec section 7).
- Pivot-tool integration for the structured pay-change fields on `PivotIdea` (the model exists but no screen uses it yet).

## Known limits
- Only two duration benchmark rows are sourced (both low confidence, from one Federal Reserve note). The 5-13, 27-52 and 53+ week buckets have no sourced rate, so uplift shows "Benchmark pending" there. Populate from CPS duration flow tables.
- Pay-change seed rows are published averages from different populations (UK career changers; two earnings-loss studies), all low confidence. "Keep your level" has no benchmark yet.
- Hires are recorded by self-report. Referral-sourced applications are not yet recorded, so the nudge counts all applications as cold (conservative).
