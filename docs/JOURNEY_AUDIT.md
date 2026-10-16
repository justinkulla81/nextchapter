# Journey audit: tailoring, engagement, portals and revenue

Written 2026-10-16 from the code on branch `claude/compassionate-edison-fkfdu5`. Static read of the code; the app was not run.
Facts below come from the files named. Anything marked **Proposal** is a recommendation, not something that exists.
`docs/CANDIDATE_JOURNEYS_AND_FEATURES.md` still says 8 journeys; the code has **11**.

## 1. The 11 journeys at a glance

Source: `src/lib/journey/journey.ts`, `plan.ts`, `menu.ts`, `search-playbook.ts`, `engagement.ts`.

| Journey | Default stage | Searching? | Own plan | Playbook | Menu mode | Specific data it collects |
|---|---|---|---|---|---|---|
| Laid off or let go | Applying | Yes | Yes | Yes (weeks 4/12/20/27/40) | Active | Last day worked, severance, benefits |
| Thinking about a move | Exploring | Yes | Yes + quiet-search plan | Yes | Exploring/Active | What's behind the move |
| Managing my career | Managing your career | No | Yes | None | Staying | None |
| Going for a promotion | Preparing | Yes | Yes | Yes | Staying until applying | None |
| Changing careers | Exploring | Yes | Yes | Yes | Exploring/Active | Target field (pivot pages) |
| Student or new grad | Preparing | Yes | Yes | Yes | Preparing/Active | Early-career audience |
| Returning after a break | Preparing | Yes | Yes | Yes | Preparing/Active | None |
| Planning the next act | Exploring | Yes | Yes | Yes | Exploring/Active | None |
| Taking a break | Managing your career | No | Yes | None | Leave | Return date |
| Happy with fractional | Managing your career | No | Yes | None | Portfolio | Offer, open days, engagement end date |
| Building something of my own | Managing your career | No | Light | None | Staying | Venture (added in this change) |

## 2. Fixed in this change

| # | Gap found | Fix |
|---|---|---|
| 1 | "Ready to start applying" kept a non-searching journey (Managing my career, break, fractional, building), so the plan showed review-prep tasks while applying | Not-looking journeys become **Thinking about a move** (employed) or **Returning** (out of work) when the member says ready, interviewing or got an offer (`changeForAnswer`, tested) |
| 2 | Win-back cron route existed but was not in `vercel.json` | Scheduled daily 16:00 UTC |
| 3 | Moving to an employed journey never prompted for Confidential Search Mode | Privacy page shows a notice above the toggle when the journey is an employed one and the mode is off |
| 4 | Check-in could not reach Promotion, Changing careers, Taking a break or Building something | Four answers added to the check-in pop-up and answer list |
| 5 | Building something had a plan step ("tell us what you are building") with no field | Venture field on the settings form, stored in `journeyDetails.venture` |
| 6 | Managing my career not in `IN_WORK_JOURNEYS` (review emails, in-work nav) | Added. Review emails remain off until `IN_WORK_REVIEW_EMAILS_ENABLED=true` |
| 7 | Taking a break + no return date was skipped by win-back forever | Skipped for 90 days quiet when no date; skipped until the date when one is set |
| 8 | Settings accepted any journey and stage pair, showed no preview, left stale details | Applying stages rejected for non-search journeys with a plain-language message; goal and plan preview shown; old move driver and return date cleared on change |

**Still open from the first audit:** the "peers at your company" community grouping has no minimum cell size (`OPEN_ITEMS.md`),
and several collected fields (Track Record, What I Need, screening, benefits priorities, `actionWindow`) had no consumer as of 2026-08-14. Recheck before building on them.

## 3. How each journey connects to a portal today

Portals: employer outplacement (`/employer`), higher ed (`/i/[slug]`), coach (`/support/coach`), recruiter (`/recruiters`),
employer hiring (`/talent`), workforce board (Your local market, CRM-only; no board portal).

| Journey | Employer / outplacement | Higher ed | Coach | Recruiter / hiring | Workforce board |
|---|---|---|---|---|---|
| Laid off | **Yes, the only journey employers can enroll into.** Seats set Laid off + Applying (`outplacement-enrollment.ts`) | Layoff flag, rapid response, Resilience Fund, layoff outreach | Yes | Dossier opt-in | Anonymous counts, WARN/area brief |
| Thinking about a move | No | Stage help: "Know what you're worth" | Yes | Confidential by default | Counts only |
| Managing my career | **No** | Thin: mentors, groups, programs | Yes | Not applicable | Not counted as a search |
| Promotion | **No** (in-work workspace exists on the candidate side) | Stage help: "Plan the promotion" | Yes | Yes | No |
| Changing careers | No | `career_pivots`, programs services (card exists) | Yes | Yes | Retraining funding via area brief |
| Student or new grad | No | Strongest fit: internships, career services, early-career check-ins at 6/18/24 months | Limited | Entry-level | No |
| Returning | No | No journey-specific help | Yes | Yes | Local programs |
| Next act | No | `encore`, `board_matching`, `business_directory` services (several have no built screen: `builtIn: null`) | Yes | Fractional/advisory boards | No |
| Taking a break | No | None | Limited | None | None |
| Fractional | No | `business_directory` | Yes | Fractional boards | No |
| Building something | No | `entrepreneur_support` (no built screen) | No | None | No |

**The structural finding:** every employer-facing product is built for people leaving a company. There is no way for a company to
sponsor people who are staying: no plan category (`PlanCatalogCategory` is OUTPLACEMENT, DIRECT_TO_CONSUMER, MEMBERSHIP), no seat
type for current employees, and no reporting a People or L&D team could buy. Yet Managing my career and Promotion are the journeys
whose plans (wins, review prep, pay benchmark, skills, sponsor) already read like an internal career-development program.

## 4. Revenue map

List prices are the seeded values in `scripts/seed-commercial-config.ts`. Anything without a price below is **not priced**.

| Buyer | Journeys served | Exists today | Revenue line | Gap |
|---|---|---|---|---|
| Employer (HR) outplacement | Laid off | Core $895 / Plus $2,450 / Premium $7,450 per seat, roster, program branding, invoices, compliance pack | Per-seat contracts | Scorecard is off by default; no API enrollment; no portal chrome re-skin |
| **Employer (L&D / retention)** | **Managing my career, Promotion, Thinking about a move (internal move), Changing careers (internal mobility)** | Candidate-side plans, Know your worth, Build your case, in-work workspace, review-prep, Track Record | **None** | **Everything on the buyer side: see section 5** |
| Employer (people at risk) | Thinking about a move (layoff worry) | Layoff-worry driver, runway steps | None | A "pre-layoff readiness" seat is a natural upsell to outplacement |
| Higher ed, career services | Student, new grad, Laid off | Services menu, early-career check-ins, internships, outcomes tab | Institutional license (pricing not in code I read) | Journey-aware help beyond two journeys |
| Higher ed, alumni relations / exec ed | Managing my career, Promotion, Changing careers, Next act | `exec_ed` and `health_insurance` marked `paid`; programs; mentors | Exec-ed program referrals, alumni paid tiers | Stage help gives Managing my career only three generic cards; exec-ed is "suggested when they close a gap" but the gap signal is not tied to the journey |
| Higher ed, development | Laid off | Resilience Fund, `donations` | Donor-funded | Not tied to the Managing my career annual check-in |
| Higher ed, employer relations | Student, Changing careers | `employer_packages` (paid; `builtIn: null`, no member screen) | Branded pages, priority posts | No built product |
| Coaches | All | Rate card ($85 to $175 per session), booking, matching | Per-session margin | Only Laid off plan and the stalled-search gate send people to coaching; no coaching nudge for promotion or career change |
| Recruiters and hiring | Searching journeys | Dossier database, role matching, flat-price hiring | Subscription / per hire | Confidential and screening rules limit supply, by design |
| Workforce boards | Laid off, Changing careers, Returning | Monthly board brief drafts; funding matches | Grants/contracts (no product) | No board portal |
| Members | All | Membership (coach, recruiter), premium plans | Direct subscription | Free-to-paid trigger per journey not defined |

## 5. Proposal: a "career growth" employer product (L&D and retention)

For companies that want to keep and grow people. Nothing here exists yet.

**What it is:** employer-sponsored seats for current employees on **Managing my career** or **Promotion** (and optionally
Changing careers for internal mobility). Same member-owned dashboard; the employer pays for access, not for visibility into a person.

**Why it fits the code:** the plan, menu mode, report framing and in-work workspace for these journeys already exist; the outplacement
seat machinery (contract, roster, invites, program bar, billing, compliance, `grantSeatAccess`) can be reused with a different journey
on enrollment instead of hard-coded Laid off.

**Build list (in order):**
1. `PlanCatalogCategory` value for career growth, and a seat type. Journey chosen per cohort at enrollment (Managing my career default; Promotion for a cohort; Changing careers for mobility).
2. Enrollment sets journey and stage from the contract, not always Laid off (`outplacement-enrollment.ts:265`).
3. Employer reporting that is aggregate only, minimum cell 10, same rules as the scorecard: activation, review-prep completed, skills gaps closed (named skills, not people), pay-benchmark reads, internal-move interest as a count. Never an individual, never mood check-ins, never confidential-mode members' detail (`docs/AFFILIATIONS.md`).
4. Manager-facing tools in `/for-managers`: give a reference, a growth-conversation prompt. Opt-in per member.
5. Company-branded program bar already exists for outplacement; reuse it.
6. Pricing: **not set**. Decide per-seat per-year vs per-cohort before building billing.

**Guardrails (these are product constraints, not nice-to-haves):**
- Retention analytics about named people would break the trust the whole product is built on. Offer "flight-risk" style views only as anonymous cohort trends, if at all, and get legal review first.
- A sponsored member who later starts a search keeps their privacy: the journey change from check-in must not notify the employer. Today `applyJourneyChange` tells only colleges; keep it that way for employers.
- Confidential Search Mode default is **on** for these journeys; a sponsor must not be able to turn it off.

## 6. Proposal: higher ed by journey

Today only Promotion and Thinking about a move change what a college shows (`stageHelp` in `src/lib/higher-ed/lifecycle.ts`).

| Journey | Add to the college home | Revenue/outcome for the college |
|---|---|---|
| Managing my career | Annual career check-in answer routes to a growth plan; mentors by function; exec-ed program matched to the skill gap from the report | Exec-ed enrollments, alumni engagement, giving |
| Promotion | Sponsor/mentor match; leadership program | Exec-ed |
| Changing careers | `career_pivots` card with alumni who made the move; retraining programs | Exec-ed, certificates |
| Student or new grad | Already strongest; add the 6/18/24 month check-in answers to the journey | Placement outcomes for accreditation and rankings |
| Returning | Re-entry program, mentor | Programs |
| Next act | Build the `encore` and `board_matching` screens (currently `builtIn: null`) | Alumni boards, giving |
| Fractional / Building something | Build `business_directory` and `entrepreneur_support` screens | Employer packages, alumni projects |

## 7. Tailoring and engagement gaps per journey

Things a member of each journey would expect that the code does not show.

| Journey | What is missing |
|---|---|
| Laid off | A "what I told my network" template tied to the first-week steps; no gap for the thing most asked for at day 1 |
| Thinking about a move | Nothing journey-specific in email beyond the shared blocks; the "quiet search" has no stealth checklist for LinkedIn and references |
| Managing my career | No playbook (no clock), so no "year in review" arc; no monthly milestone email; review emails are off by default |
| Promotion | No tracked promotion case (ask, evidence, sponsor, date) shared with the coach; no reminder tied to company review cycles other than the in-work cadence |
| Changing careers | No "readiness to switch" score against the target field; the Pivot page has no per-person rating (`OPEN_ITEMS.md`) |
| Student | Playbook stops at week 20; no internship-vs-full-time branch |
| Returning | Plan text only; no gap-explanation tool (story builder), no refresher course path |
| Next act | Plan points to interim and board work but the board path is thin |
| Taking a break | Nothing happens when the return date passes beyond the check-in |
| Fractional | Pipeline and renewals are plan steps; no pipeline tracker (engagements, rate, renewal dates) beyond the single end date |
| Building something | No venture check-in, runway tracker or "way back" plan beyond two plan lines |

## 8. Suggested order

1. Decide whether the career growth product (section 5) is wanted; it is the largest new revenue line and reuses the outplacement stack.
2. Parameterize enrollment by journey (small, enables 1).
3. Build the college screens that are `builtIn: null` for Next act, Fractional and Building something.
4. Add journey-aware branches to `stageHelp` for the six journeys that get nothing.
5. Fill the per-journey engagement gaps in section 7, starting with Managing my career and Promotion since they feed the employer and college products.
