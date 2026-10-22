# Audit: career pivot tool, career growth (employer) and "fit future"

Read-only audit, 2026-10-18, branch `claude/candidate-dashboard-redesign-djr3g2` at 8a92cac6 (career story branch `claude/compassionate-edison-fkfdu5` merged at d7f0563e). Everything below was checked in code unless it says "not checked". Nothing was opened in a browser.

Redesign rules used: `docs/candidate-redesign.md` (one headline, one primary action, at most three sections, every claim says why, one note on Home only, no badges, no stage stepper, serif display + Inter, one orange action color, navy once per page), `docs/personalization-audit/README.md` and `bundles.md` (strips; bundle L3 "Open to a change?"), `docs/finances-and-benefits.md` (money opt-in), `src/lib/nav/redesign-places.ts`.

## Summary

| | Merged into HEAD? | Wired to real data? | In the redesign menu? |
|---|---|---|---|
| A. Pivot tool (pivot paths, What would it take, Thinking about a pivot, stance history) | Yes | Yes, all on one page; but not wired to job matching or the Career change journey plan | Learn > "Other roles you could do" (label only renamed) |
| A2. Career story (timeline, doors, pause what-if) | Yes | Yes (needs `prisma/manual/2026-10-17-career-events.sql`) | Learn > "Career story" |
| B. Employer career growth seats and portal | Yes (career branch + main's program types, merged by hand) | Yes, never opened in a browser | Employer portal is outside the candidate redesign; candidate side (`internal-roles`, `company-courses`, `StaffProgramCard`) is NOT in the redesign menu |
| C. "Fit future" | Nothing by that name | n/a | n/a |

---

## A. Career pivot tool

### 1. What it is and where it lives

One candidate page does almost everything: https://launchyournextchapter.com/dashboard/pivot-paths (`src/app/dashboard/pivot-paths/page.tsx`, 404 lines; `actions.ts`, `loading.tsx`). https://launchyournextchapter.com/dashboard/pivot only redirects there. The page stacks, top to bottom (all merged, all live code):

1. `PivotRadar` (`src/components/dashboard/pathway/PivotRadar.tsx`): "Thinking about a pivot". Each saved target has a stance (On my radar, Trying it out, Getting ready, Going for it, Not for me right now) and a feeling (Excited, Curious, Not sure, Nervous, Scared), with a dated history. Server action `updatePivotStance` fires `pivot_stance_changed`. Industry interests too (`updateIndustryInterest`).
2. `PivotIdeas` (`pathway/PivotIdeas.tsx`, `src/lib/journey/pivot-ideas.ts`): ideas for people who don't know where to start: nearby functions, industries where their function travels, skills to build, and "not a change of function" options. No model calls.
3. `PathwayExplorer` ("What would it take", `pathway.ts` 287 lines, `feasibility.ts`, `industry-feasibility.ts`, `onet-overlap.ts`): for a chosen function, what you have, what you need, cost range, months, challenges, alternatives by reason ("why" param), and an `IndustryRealityCheck`. Curated in-code profiles (`FUNCTION_PROFILES`); costs are ranges, not quotes, and say so.
4. `LearningPathsCard` (`learning-paths.ts`, `learning-paths-data.ts`): learning paths tied to the pivot goal, with step progress (`completePathStep`).
5. Then the older O*NET/BLS "Pivot Tool" (`PivotPathsBody`, `src/lib/careers/*`, `components/dashboard/pivot/*`, `pivots/*`): ranked options with pay, growth, openings, funded training; "More roles that use similar skills"; "Look up any role"; wage floor; `LikesCard`, `WorkAlikeCard`, `PeopleEnergyQuestion`, `WorkStylePrompt`, saved choices.

Related pieces:
- `src/lib/journey/pivot.ts` (stance, feelings, `PivotTarget`, stored in `journeyDetails.pivot`, no schema change); `career.ts` (staying-in-a-job goals: review date, next level; saved by `src/app/dashboard/search-strategy/career-actions.ts`, event `career_goals_saved`).
- Career story: https://launchyournextchapter.com/dashboard/my-career (`src/lib/career-story/*`, `components/dashboard/career-story/*`). Timeline, "doors you could open", pause what-if (`PauseTool`), "People like you" (`PeersCard`). Link from pivot paths to it exists. `retirement.ts` adds four "stepping back" paths as an overlay on Next act / Growing.
- Job board hand-off: `?pivot=` on https://launchyournextchapter.com/dashboard/find-my-job narrows the board to one target's titles (`src/lib/pivots/board-filter.ts`, `PivotBoardBanner`). Separate older module `src/lib/pivots/*` (pivot map, outlook, scoring) is a second "pivot" code area with a similar name to `src/lib/journey/pivot*.ts` and `src/lib/careers/pivots.ts`: three places, three meanings of "pivot".
- Docs: `docs/CAREER_TAXONOMY.md` (71 lines; note it says "the Pivot Tool" and `/dashboard/pivot-paths` and describes only the O*NET layer, not the pathway map), `docs/CAREER_STORY.md` (27 lines, still says tab "Career timeline" under Personalize, which no longer exists in the redesign menu), `docs/what-you-asked-for.md` rows 11, 12, 31. No standalone doc for "What would it take" / stance history besides these and the personalization audit.
- Mockup: `/dev-preview/learn/path/roles` ("Other roles you could do", `MarketPivot` in `src/app/dev-preview/_mockups/jobs-more.tsx`) and `/dev-preview/learn/path/story` (real career story with sample data). The mockup shows only a list of roles with carry-over, gap and a training line. It does not show the radar, ideas, pathway map or stance history.

Data state (from `docs/what-you-asked-for.md`, not re-verified): occupation data and 5,814 funded programs loaded; course-to-skill tags 0 rows, so course suggestions are empty. Career story needs its SQL applied before launch.

### 2. Where it fits and what must change

Place: **Learn**, entries "Closer to hired" strip, then tab "Your path" (`redesign-places.ts` groups `/dashboard/my-career`, `/dashboard/pivot-paths`). The menu tab label is "Other roles you could do"; the group is "Your path".

Needed changes (the live page breaks the page contract):
- `pivot-paths/page.tsx` has far more than three sections on first view (radar, ideas, explorer, learning paths, ranked options, likes, work-alike, saved choices, similar skills, look-up) and a plain-sans `h1` "Pivot paths". Split by purpose, as rule 7 says:
  - **Other roles you could do** (headline; primary action "See what it would take" or "See N jobs"): ranked options (`PivotOptionCard`) only.
  - **What it would take** (opens from a role; one role at a time): `PathwayExplorer` + `IndustryRealityCheck` + one training line. Drop the separate "Look up any role" and "More roles that use similar skills" into "Show more".
  - **Your list** (radar with stance and feelings): `PivotRadar`, reached from the roles you saved; a small tab or "Show more".
- `PivotIdeas` is for people with no target. Show it only as the empty state of "Other roles you could do" (when no target and L3 not answered). This removes a card.
- `LikesCard`, `WorkAlikeCard`, `PeopleEnergyQuestion`, `WorkStylePrompt` are questions on a working page. Under the bundle rule (questions live in bundles, asked once) they belong in Learn "Know yourself" / the L3 bundle; remove them from this page.
- `LearningPathsCard` duplicates Learn > Learn new skills. Say what it replaces: keep it only as the "training" line of one role's "What it would take" and link to Learn new skills.
- Headings: replace `text-2xl font-semibold` with the serif display class used in the career story page (`font-display`), as `CareerStoryView` already does.
- Every claim says why: ranking says "ranked by skill similarity" (true, `pivots.ts`), but pay/openings sit "beside" it unexplained; cost/time ranges say "typical, not quotes" (keep). Stance and feelings: say why we ask ("so the plan matches where you are") before the five buttons.
- Feelings and stance are 5 + 5 options: rule 1 (2-4 buttons) and the 5+ rule say a dropdown, but they are emotional choices; keep as buttons and flag the tradeoff to the owner.
- Career story page has four blocks (timeline, doors, pause what-if, people like you) on one view. Keep timeline as the headline, move "pause what-if" to its own entry under money opt-in (see conflicts), keep doors as the primary action ("See a door"), and fold "People like you" behind "Show more".
- Per `candidate-redesign.md`: build the split in `src/app/dev-preview/` first and screenshot. Only the roles list exists as a mockup; the pathway map, radar and ideas need preview screens before any real wiring.

### 3. Conflicts

| File | Rule or work in conflict | What to do |
|---|---|---|
| `src/app/dashboard/pivot-paths/page.tsx` | Page contract (3 sections, one action); serif headings | Split as above. |
| `src/lib/journey/apply.ts:61` vs pivot targets in `journeyDetails.pivot` | Pivot targets never set `targetFunction`/`isPivoting`; only choosing the CAREER_CHANGE journey sets `isPivoting`. Job matching reads `targetFunction ?? (isPivoting ? null : primaryFunction)` (per `journeys.md`). Saved pivot targets only affect the board through the `?pivot=` URL. | L3 must write one source of truth. Recommend: L3 answers set `isPivoting`, and the "Going for it" stance sets the board target; stop having three stores (`isPivoting` + `targetFunction`, `journeyDetails.pivot.targets`, `pivotInterests`). |
| `docs/personalization-audit/journeys.md` (Career change "not wired to pivot tools"; "Map your transferable skills" has no tool) | Partly fixed by the merge (flag set on journey choice) but `plan.ts` CAREER_CHANGE steps ("Map your transferable skills", "Pick three target roles") are still plain text. | Link first-week steps to Other roles you could do and What it would take. |
| `src/components/dashboard/pathway/PivotRadar.tsx` stance "Going for it" etc. | "No stage stepper" (Exploring, Preparing, Applying) | The five stances look like a stepper and mirror the journey stages (PREPARING, GOING_FOR_IT). Show as a quiet label plus "Change", never a progress bar; do not mirror `journeyStage`. |
| Feelings history (`pivot.history`) | Privacy: personalization README says check-in answers are never shown to employers/recruiters | `employerCandidateAggregates` and `career-growth-metrics.ts` do not read pivot; keep it that way. Add a test (like the one that restricts `CareerEvent` reads). Not found today. |
| `PivotRadar` and the mood check-in on Home | One check-in on Home; feelings captured in two places | Make feelings optional on the pivot, and let the Home check-in read them, not ask again. |
| `src/lib/redesign/tailored.ts` "Direction" row | Weight 0, `done: true` always: the row cannot be incomplete | Replace by L3. |
| `docs/CAREER_STORY.md` | Says "tab Career timeline under Personalize"; Personalize place removed | Update the path text. |
| Pause what-if (`PauseTool`, `cushionMonths`) vs money opt-in | `docs/finances-and-benefits.md`: if the member says no to money help, no savings or runway questions. `PauseTool` is always shown on the career story. `money-help/actions.ts` already clears `cushionMonths` on "no", good, but the tool still renders a prompt. | Hide the pause what-if and its cushion input when `moneyHelp` is not true; when true, link it to Your runway. Note `finances-and-benefits.md` says the branch collects savings, severance and monthly need; the code stores only `cushionMonths`. Correct the doc. |
| Three "pivot" code areas | Maintenance, naming | Not urgent; rename in docs only (`journey/pivot*` = member's stance, `careers/` = O*NET data, `pivots/` = older pivot map and board filter). |

### 4. Old or does not fit

- "Pivot paths" as a page title and `docs/candidate-feature-map.md` calling it "the career explorer": now "Other roles you could do".
- `PivotPathsTeaser`, `PivotBoardBanner` and `PivotBoardPrompt` on the Jobs board: banners on a working page. The banner explaining a filter is useful (keep it as the filter label); the prompt/teaser is an extra card and should go (tailored strip covers it). Not checked whether the board adds more than one pivot card.
- Search Strategy checkbox "I'm considering a career pivot" (`isPivoting`): replace by L3 (bundle says so).
- `src/lib/reports/career-pivoter-redirect.ts` copy is only in the Market Reality report, not Home; leave.
- `docs/CAREER_TAXONOMY.md` is still accurate for data but does not cover the pathway map, the radar or the ideas.
- `career.ts` (review date, next level, focus, intent) belongs to Growing/Promotion, not to pivoting; it sits in Search Details. It fits "Jobs > Offers and raises" or the Growing plan, not Learn.

### 5. New ideas

- Make "What would it take" the receipt of L3: after the member answers "Open to a change?", the finish screen shows the top role with cost, months and what carries over (a type A receipt, real numbers).
- Use the stance as a Home signal: "Trying it out" for 6 weeks suggests one informational call; "Not for me right now" stops pivot nudges (the audit wanted a respectful stop). Also resolves "week 6: suggest a pivot" from the README: suggest only if the member has not set it aside.
- Pair every "What it would take" with the runway number when money help is on (cost of the pay dip), as `finances-and-benefits.md` row "Changing careers" asks.
- One shared "bridge job" path: link to the independent-work toolkit (journeys.md notes it is locked for career changers).
- Employer growth seats already show "Career pivot paths" as a tile: the pivot page can show an optional line "Roles at {employer}" for staff (ties A and B).

### 6. Incorporation steps

1. Decide the single source of truth for target field (see conflicts) and write it in `bundles.md` L3 and `docs/CAREER_TAXONOMY.md`.
2. Build preview screens in `src/app/dev-preview/_mockups/` for: Other roles you could do (exists, add empty state with `PivotIdeas`), What it would take (one role), Your list (radar and stance), and the L3 flow plus receipt. Screenshot, owner approves.
3. Split `pivot-paths/page.tsx` by purpose; keep URLs (`/dashboard/pivot-paths?target=`) working so links from the board and emails still land.
4. Move the four question cards out into Know yourself / L3.
5. Wire L3 answers to `isPivoting` + `targetFunction`; change `plan.ts` CAREER_CHANGE steps to link to the new pages.
6. Gate the pause what-if on `moneyHelp`; point it at Your runway; fix the savings/monthly-need wording in `finances-and-benefits.md`.
7. Add a privacy test that employer/recruiter code never reads `journeyDetails.pivot`.
8. Update `redesign-places.ts` labels (tab "Other roles you could do" ok) and the docs (`CAREER_STORY.md`, `candidate-feature-map.md`).
9. Apply `prisma/manual/2026-10-17-career-events.sql` before launch; load the course-to-skill tags or hide the empty course suggestion block.

### Relation to Learn > Your path, Improve your search and L3

- **Learn > Your path** is the home of A. Entries: Career story (past), Other roles you could do (future); "What would it take" and the stance list are views under the second. The strip "Closer to hired" on Learn holds skills have/want, goals, pivot interests, time available.
- **Improve your search** (`/dashboard/improve`, `src/lib/redesign/tailored.ts`, mockup `/dev-preview/home/tailored`) lists every personalization with its payoff. Its "Direction" row (done: true, weight 0, href pivot-paths) should become the L3 row: "Open to a change?", not tuned until answered, payoff "other roles you could do and what each would take". `improve/page.tsx` passes `exploringOtherRoles: profile.isPivoting`; once L3 sets `isPivoting`, the row reads right.
- **L3 "Open to a change?"** collects: pivoting [95], target function [96], start at a lower level [97], "big change or more of the same" [122]. Receipt kind A (real numbers). Today these map to: `isPivoting` + `targetFunction` (Search Strategy), `journeyDetails.pivot` targets (pivot-paths), `pivotInterests` (industries). L3 should write the first two and prefill the third from the pivot page; the "willing to start lower" answer maps to the pivot's `tier`/step-down and to the `PivotRadar` tier labels. Pivot-paths then reads the answer and never asks again.

---

## B. Career team: employer career growth

Name check: "Career team" was not found as a feature name. The closest is the employer "Team" page (`src/app/employer/(app)/team/page.tsx`: who has access to the employer account, admin/viewer/legal/finance), which is unrelated to career growth. The work matching the description is below.

### 1. What it is and where it lives

Employer pays for seats for current employees. Two overlapping models were merged by hand (`what-you-asked-for.md` row 31: "Employer seats keep main's program type and the career branch's seat journey"):
- **Program type** (from main): `OutplacementProgramType` OUTPLACEMENT / GROWTH / LEARNING (`prisma/schema.prisma` ~8144; `src/lib/employer/program-type.ts`, `staff-programs.ts` 321 lines, `program-server.ts`). Employer pages: `src/app/employer/(app)/growth/page.tsx` (+ `growth/roles/[id]`, internal roles), `learning/page.tsx`. Candidate pages: https://launchyournextchapter.com/dashboard/internal-roles ("Roles at your company"), https://launchyournextchapter.com/dashboard/company-courses, `StaffProgramCard` on Home and `CompanyCoursesCallout` on Learn (https://launchyournextchapter.com/dashboard/learning).
- **Seat journey** (from career branch): the contract's `journey` (`src/lib/journey/sponsored.ts`: LAID_OFF, GROWING, PROMOTION, CAREER_CHANGE), `sponsoredStart` and `shouldApplySponsoredStart` (a career growth seat never overrides someone who is job searching), `src/lib/employer/program-wording.ts` (`programKindOf(journey)` = OUTPLACEMENT or GROWTH; label "Career growth"), `seat-continuity.ts` + `SeatEndingBanner` (last 30 days), `career-growth-metrics.ts` and `career-growth-reporting.ts` (6 measures + "signed in", min cell 10, rounding to 5 under 50, shown on `employer/(app)/reporting`), seat emails in `src/emails/outplacement-access-ending.tsx`.
- Tests: `sponsored-seats`, `seat-continuity`, `career-growth-reporting`, `staff-programs`. Not run by me.
- Employer-side URLs would live on the employer host; I did not verify the final domain, so I give paths only: `/employer/growth`, `/employer/learning`, `/employer/reporting`, `/employer/seats/accept`.
- Nothing has been opened in a browser; production has zero organizations (`what-you-asked-for.md` row 15).

### 2. Where it fits and what must change

The candidate site has no "employer benefit" place. Fit:
- **Home**: `StaffProgramCard` and `SeatEndingBanner` are two cards on Home (`src/app/dashboard/page.tsx` lines 473, 484, 589, 608, each rendered in two branches). Rule: one note on Home only. Make the seat-ending message a candidate for the single Home note (it is time-bound and useful), and delete the `StaffProgramCard` tiles from Home.
- **Jobs**: "Roles at {employer}" (`internal-roles`) is a source of jobs; add it as a filter chip or a first group inside Jobs > Find a job ("From my groups" already exists for private communities, and `candidate-redesign.md` says private communities appear in Jobs, Network and Learn). Add to `redesign-places.ts` Jobs `alsoMatches` for `/dashboard/find-my-job` or as a tab only when the member has a Growth seat.
- **Learn**: "Courses {employer} covers" (`company-courses`) belongs in Learn > Learn new skills as the first row, "your employer pays for these" (already a callout; make it the strip's payoff, not an extra card).
- `redesign-places.ts` does not list `/dashboard/internal-roles` or `/dashboard/company-courses` at all, so under the redesign menu the pages have no place and `redesignPlaceForPath` returns null for them. Fix first.
- Employer portal (`src/app/employer/(app)`): out of scope of the candidate redesign (step 3 in "How a page gets built": partner portals follow later). When restyled, `growth/page.tsx` has four-plus sections (participation, outcomes, teams, internal roles list) and needs the same one-headline / three-sections treatment.

### 3. Conflicts

| File | Rule or work in conflict | What to do |
|---|---|---|
| `src/lib/employer/career-growth-metrics.ts` ("Earned a learning badge" measure, `learningBadges`) | Owner decision: no badges (`what-you-asked-for.md` row 27) | Rename the measure ("Finished a learning path") and base it on completions, not badges, when badges go. Check `growthReport` in `staff-programs.ts` for the same measure (not fully checked). |
| `programKindOf(journey)` in `program-wording.ts` vs `programType` | Two ways to say what a seat is. A LEARNING contract has `journey` null, so `programKindOf` returns OUTPLACEMENT: `employer/(app)/page.tsx` shows the outplacement blurb ("For people who are leaving") under a Learning contract, and `SeatEndingBanner` shows outplacement continuity copy for a Learning seat. Confirmed in code, not in a browser. | Make `ProgramKind` derive from `programType` first (OUTPLACEMENT, GROWTH, LEARNING) and use `journey` only for the starting journey. Add LEARNING copy to `seat-continuity.ts` and `program-wording.ts`. |
| Two employer reports | `career-growth-reporting.ts` (reporting page) and `growthReport` in `staff-programs.ts` (growth page) both count growth activity, with different measure lists. Risk of two numbers for the same thing. | Pick one; have the growth page use `getCareerGrowthActivity`. |
| `StaffProgramCard` tile "Career pivot paths" | Employer's privacy promise: "never that you're looking around". Pivot stance and feelings are stored in the same member profile; the employer sees counts only (`employerCandidateAggregates`) so it holds today. | Keep the aggregate guard; add the test in A. |
| `StaffProgramCard` / Home | One note on Home only; no extra cards | Remove from Home; see above. |
| Menu | `internal-roles` and `company-courses` missing from `redesign-places.ts`; `docs/candidate-feature-map.md` says "Only a card on Home" | Add to Jobs and Learn as above. |
| `sponsored.ts` journeys (GROWING, PROMOTION, CAREER_CHANGE) | The Career change journey is one of the four employer seat options, yet wiring of that journey to the pivot tools is incomplete (see A). A seat that starts Career change gives a thin plan. | Fix A step 5 first. |
| Terms | "Higher education" and "Career growth" are used; the program type label is "Growth", the wording file says "Career growth", the portal page title says "Growth" | Pick "Career growth" for candidates and employers; "Growth" is an internal enum. |
| Seat ending when `shareOutcomeWithEmployer` | Promotions and raises are shared only if the member chose (`staff-programs.ts` comment). Not visible on a candidate page I checked. | Add a plain-words toggle in Account and privacy > Privacy ("Share my promotion or raise with {employer}"); not found today (not checked in `privacy` page). |

### 4. Old or does not fit

- `StaffProgramCard` as a four-tile card: an old pattern (card with tiles). Redesign replaces with the Jobs and Learn entries.
- Doc `docs/JOURNEY_AUDIT.md` and `candidate-feature-map.md` rows about these pages are stale once the menu changes.
- `SPONSORED_JOURNEYS` labels ("Managing their career") do not match the candidate journey names; check against `journey.ts` card names.

### 5. New ideas

- Employer-covered learning as a visible "free for you" tag on courses in Learn (a fact with a why: "your employer pays", not a badge).
- Internal mobility as a pivot route: in "What would it take", say "this role exists at {employer}" using `InternalRoleInterest` counts (aggregate, min cell 10).
- A candidate-side "what my employer sees" line in Account and privacy, since the promise (counts only) is a trust feature.
- Seat-ending as a gentle bridge to membership: the banner already lists what stays; it could carry the single orange action "See membership options" and nothing else.

### 6. Incorporation steps

1. Fix `ProgramKind` so Learning contracts are not described as outplacement (small, testable).
2. Replace the badge measure with completions; reconcile the two growth reports.
3. Add `/dashboard/internal-roles` and `/dashboard/company-courses` to `redesign-places.ts` (Jobs and Learn, shown only with a seat); extend the place tests.
4. Remove `StaffProgramCard` from Home; fold the seat-ending text into the one Home note.
5. Preview screens for "Roles at {employer}" in Jobs and "Courses covered" in Learn; screenshot; then wire.
6. Privacy: add a test that employer queries never read pivot/career story tables; add the "share outcomes" control to Account and privacy.
7. Restyle the employer pages when partner portals are done (later).
8. Open one demo org end to end (nobody has).

---

## C. "Fit future"

### 1. What was found

- **Nothing named "Fit future", "FitFuture" or "future fit"** in code, docs, or remote branch names (grep over the repo, case-insensitive, excluding `node_modules`). The only hit is `docs/WORKFORCE_VENDOR_LANDSCAPE.md` line 13: **FutureFit AI**, an outside competitor (skills-based career navigation sold to governments), described as "closest to a consumer-facing competitor". It is not our feature. The owner may be remembering that name, or a name that came from a conversation I cannot see.
- Closest candidates, all real:
  1. **Job fit verdicts** (merged to main from `claude/friendly-cerf-p3639f`): `src/lib/jobs/job-card.ts` ("Strong fit / Good fit / Worth a look" with one why line), `job-fit-bucket.ts` (score and bucket: strong, good, stretch, below_level, overqualified), `fit-bucket-types.ts`, `job-match.ts`, `job-card-server.ts`, `JobMatchPanel`. This is exactly the redesign's "Job row" and sits in Jobs > Find a job. It already follows rule 4 (one reason) and rule 5.
  2. **Skills fit band** (`src/lib/careers/skills-fit.ts`, `docs/CAREER_TAXONOMY.md`): "lines up closely / mostly / partly / few in common" beside the fit badge, uses O*NET; shows nothing until O*NET is loaded.
  3. **AI outlook of your field** (`src/lib/profile/ai-outlook.ts`, `occupation-trends-data.ts`; shown on https://launchyournextchapter.com/dashboard/market and in the Learn trends card). AI exposure per function, growth or decline, how critical AI tools are. Source: the company's White Collar Employment Report. This is the nearest thing to "future of work".
  4. **AI displacement question** (`aiJobLossReason`: yes / partly / no / prefer not to say, asked in onboarding `LocationForm`; read by `engagement-data.ts` and `learning-paths-data.ts` to add an AI outlook item to the weekly plan and a learning path). No visible payoff to the member besides that item; the audit lists it as irrelevant to students.
  5. **AI skills layer** (main, documented in `docs/AI_SKILLS.md`): 24 skill items, job board AI / Non-AI / All toggle (`AiViewToggle`), skills gap naming AI asks, Learning section "Skills your best-fit jobs ask for", AI work samples, `ai_*` events. Merged to main; the 16-skill draft was retired 2026-10-17.
  6. **Branch `origin/ai-skills-taxonomy`** (one commit d23db4b2, 2026-10-16): the retired 16-skill draft (`src/lib/ai-skills/*`, `AiSkillGapSection`). Not merged into HEAD or main, and superseded by item 5 per `AI_SKILLS.md`. Also `origin/ai-view-consolidate`: no commits ahead of main in my check (empty diff list).
  7. `docs/AI_SKILLS.md` says "Learn (L2): confidence in AI skills" is a personalization bundle (bundles.md L2 "AI skills", receipt B).

### 2. Where it fits

- Verdicts: Jobs > Find a job (primary), already redesign-ready; keep "Why this fits" under the row.
- AI skills toggle: Jobs board is one more control on a working page. Rule: say what it removes. Candidate removal: the three-button AI / Non-AI / All group could move into the "Better jobs for you" strip (an answer to L2), leaving the board with filters only if asked.
- AI outlook: Learn > Your path as a single line in "What it would take" ("AI exposure in this field: X, because ..."), and Jobs > Market. Not a new card.
- AI skills gap: Learn > Learn new skills (`AiSkillGapSection`), with its three buttons (2-4 options: buttons, ok).
- Any future "Fit future" (if it means "how well does my role fit the future"): best home is a one-line "why" in Other roles you could do (growth %, AI exposure, openings) rather than a new page.

### 3. Conflicts

- Rule 4/5: the AI toggle, the skills-fit band and the AI gap line add facts per row; keep only one verdict, one reason, one fact on the row (`candidate-redesign.md` Job row). Move the skills-fit band under "Why this fits".
- Naming: if the owner wants a feature called "Fit future", it collides with the existing "fit" vocabulary (Strong fit / Good fit). Choose a plain-benefit name per "Names say the benefit".
- Retired draft on `ai-skills-taxonomy` would conflict with main's `src/lib/skills/ai-skills.ts` if ever merged (two taxonomies). Do not merge; delete the branch after the owner agrees.
- `aiJobLossReason` is a sensitive question with no visible payoff: the "no honest payoff, no question" rule says wire it into a visible receipt (AI skills plan change) or drop it. It is bundle L2 territory.
- AI exposure data cites a research estimate ("could do in principle"), not job loss. Keep the stated caveat wherever it shows (every claim says why).

### 4. Old or does not fit

- Branch `origin/ai-skills-taxonomy` (retired draft).
- Any copy that frames AI as personal risk ("at risk") is against "always positive"; `ai-outlook.ts` copy was not read line by line, check it.

### 5. New ideas

- If "fit future" means a future-proof score: avoid a single number; show "roles near yours that are growing" with a reason, in Other roles you could do.
- A one-question L2 receipt: "You said you are not confident with AI tools: here are the 3 AI skills your best-fit jobs ask for, with a course each" (kind B, uses existing `AiSkillGapSection`).
- AI-skills premium (like-for-like) as the "why" on the AI course link.

### 6. Incorporation steps

1. Ask the owner what "Fit future" refers to (FutureFit AI the competitor, AI outlook, or something unbuilt) before any build.
2. Do not merge `origin/ai-skills-taxonomy`; confirm main's AI skills system is the one.
3. Put AI outlook as one line in Other roles you could do and "What it would take".
4. Move the AI toggle into the Jobs strip or remove it from the board header; say what it removes.
5. Wire or drop `aiJobLossReason` via bundle L2.

---

## Cross-cutting items for the owner

1. Single source of truth for "target field" (affects A, B journeys, and C fit).
2. The seat ProgramKind bug (Learning seat shown as outplacement) is the one concrete defect found.
3. Menu: `redesign-places.ts` omits `internal-roles`, `company-courses` and the `pivot` redirect page; `redesignPlaceForPath` returns null for them.
4. Badge language remains in the employer growth measures.
5. Not verified: browser rendering of any page; test suite status (the owner reports 3,000 tests pass); live data; employer host URLs.
