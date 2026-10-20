# Audit: the Market Reality Report work

Read-only audit, 2026-10-18. Checked on branch `claude/candidate-dashboard-redesign-djr3g2` (HEAD 8a92cac6, 53 commits ahead of origin/main) against origin/main and the named branches. "Not found" means I searched and did not find it.

## 1. What it is and where it lives

Two different things share the word "report". Keep them apart.

**A. The member's Market Reality Report and grade (candidate-facing, private).** Merged on main.

| Part | Where | Notes |
|---|---|---|
| Report page | https://launchyournextchapter.com/dashboard/market-reality (`src/app/dashboard/market-reality/page.tsx`, 991 lines) | 13+ sections: Glossary, Executive Summary, Where you stand, What's working, Areas for improvement, What to fix on your resume, How a recruiter will read this, Getting past the filters, Next steps, Your next week, The market for your role (MarketSizeSection), What's My Pattern, Application Trends, Rejection Patterns, Search diagnosis, Strategy guidance from Victoria, Career story. Print and "Email me this report" buttons. |
| Report generator | `src/lib/reports/market-reality-report.ts` (LLM, zod schema, tone enum `very_positive / positive_with_work / significant_climb`) | Stored as `MarketRealityReport`. Regenerate only after N completed tasks. |
| Live sections | `src/lib/reports/market-reality-sections.ts` (template, no LLM): Where you stand, rubric ("about N applications or conversations per interview"), resume fixes, recruiter read, ATS matrix | |
| Scoring | `src/lib/scoring/market-reality/` (composite, blend, probability, calibration, attempts, effort, market, narrative, evidence, reviewer-detections) | Composite of Experience + Resume, capped by Market, becomes the "starting band". `computeProbabilityGrade` turns it into a per-attempt interview probability, bands A to F, recalibrated weekly. |
| Grade vocabulary | `src/lib/scoring/grade.ts`: `GRADE_LABEL`, `GRADE_BAND_DESCRIPTION`, `GRADE_RECRUITER_IMPRESSION`, `GRADE_INTERVIEW_ODDS`, red/amber/green colours | |
| Weekly snapshots | `src/lib/scoring/market-reality-snapshot.ts`, cron `/api/cron/market-reality-snapshot` (vercel.json), table `MarketRealitySnapshot`; history in `market-reality-history.ts` | Stores `probabilityGrade` each week. |
| Grade surfaces | Home top strip (`DashboardTopStrip.tsx`, tile "Market Reality Assessment"), https://launchyournextchapter.com/dashboard/stats (Market Reality card, week-by-week summaries, "moved X to Y"), `/onboarding/score` reveal (`ScoreRevealSection.tsx`), `ReportReadyDailyMessage`, `MARKET_REALITY_COMPLETE` badge (`milestone-badges.ts`) | |
| Emails | `send-market-reality-report.ts` ("Your Market Reality Assessment is ready", folds in a badge line), `send-grade-calibrated-up-email.ts` (only upward crossings) | Downward moves show on page only (`getCalibrationMessage`). |
| Marketing | `SampleMarketRealityReport.tsx`, `lib/marketing/sample-market-reality.ts` | Public sample. |
| Admin | `src/app/support/admin/(portal)/candidates/[id]/market-reality/[reportId]/page.tsx` | |

**B. The market pages (data, not a grade).** Merged on main.

| Page | URL | What it is |
|---|---|---|
| Market | https://launchyournextchapter.com/dashboard/market | "Your job market": open jobs for your role (local, remote, national), 14 v 28 day trend, "Worth knowing" warnings (MarketFlagsCard), AI exposure, opt-in widening (places, roles, industries). Owner's market-size work: `src/lib/market/market-size.ts`, `market-size-stats.ts`, nightly cron `/api/cron/market-size`, `MarketSizeSection` / `MarketSizeBlock` (also embedded on Find a job, Search details, and the Market Reality page). |
| Market Intelligence | https://launchyournextchapter.com/dashboard/market-intelligence | Comp band, insider network, weekly brief, target list builder, contact data, board and advisory. Tier-locked cards ("LockedFeature"). |
| Know your worth | https://launchyournextchapter.com/dashboard/pay | Pay position, filed wages, Adzuna market, what matters besides pay. |
| Local market | https://launchyournextchapter.com/dashboard/local-market | Area brief: anonymous member counts, layoffs filed (WARN), who is hiring, news. |

**C. Not candidate-facing.**
- Monthly member report (`src/lib/reports/monthly-user/`, `docs/monthly-user-report.md`): admin-only aggregates at https://launchyournextchapter.com/support/admin/monthly-report plus an email to the owner. Merged on main (PR #23). `origin/claude/intelligent-knuth-k3udw9` is the same commit, not merged as a branch (squash-merged); the only difference from main is one line in `notify.ts`.
- Public White Collar Employment Report (marketing, BLS data): `src/lib/reports.ts`, `src/app/reports/`. Main already has `REPORT_NAME = 'NextChapter White Collar Employment Report'`. Unrelated to the member's grade.

### Merged or only on a branch

| Item | Status |
|---|---|
| Everything in parts A and B above | On origin/main. |
| Redesign nav (`redesign-places.ts`), `candidate-redesign.md`, `candidate-mockups.md`, dev-preview mockups, `home-note.ts` | Only on `claude/candidate-dashboard-redesign-djr3g2`, not on main. |
| `origin/employment-report-phase1` (accept new edition names), `-phase2` (public naming, 31 files), `-phase3` (hero stats sourced and balanced), `-followup` (hero citations) | Not merged. 344 to 392 commits behind main. Main later chose the longer name "White Collar Employment Report", so these four are superseded in naming. `phase3`'s `hero-stats.ts` (every stat has a source, evidence tag, bright spot and cloud) is not on main. |
| `origin/report-employment-frame` | Fully merged (0 ahead). |
| `origin/stats-sept-2026` | Not merged. Homepage and why-stuck stats, plus `docs/report-publish-checklist.md` (rule 8: unsourced stats become "unverified" or are removed; rule 9: balanced wording). |
| `origin/claude/admiring-johnson-32j5ln` | Not merged. One doc, `docs/marketing/monthly-report-routine-prompt.md`: scheduled-task instructions for the monthly public Employment Report (not the member monthly report). Contains the owner's editorial rules (see 5). |
| `origin/ccr-4081de5b-or2tsf` (layoff news) | Not merged, 271 behind. Cron `/api/cron/layoff-news` every 3 hours, Google News feed, dedupe of layoffs.fyi against news (`warn/sync.ts`, `news/discover.ts`). Feeds `WarnNotice`, which Local market (`workforce/area-brief-data.ts`) and company pages read. |
| `origin/claude/exciting-johnson-lcf7h8` (not on your list; found in `what-you-asked-for.md` line 86) | Not merged. Jobs report crawlers by city (Louisville, Pittsburgh). Feeds local job data only. |
| Branch with a redesign of the Market Reality Report page itself | Not found. No dev-preview screen for the report page; `docs/candidate-mockups.md` lists none. |

## 2. Where it fits the redesign

Redesign places: Home, Jobs, Network, Learn, Finances and benefits, Account and privacy, Help.

- **Jobs > "Market and pay"** (`redesign-places.ts` group, tabs `/dashboard/market`, `/pay`, `/local-market`). `/market-reality` and `/market-intelligence` are `alsoMatches` of the Market tab, so they sit under it with no tab of their own. Mockups: "Your market" `/dev-preview/jobs/market/market` (replaces market, market-reality, market-intelligence), "Know your worth" `.../pay`, "Local market" `.../local` (local-only URLs, run the app and open them).
  - Gap: the brief says four reports merge into one entry (Market, Market Reality, Market Intelligence, Local market). The mockup merges three pages into "Your market" and keeps pay and local as parts. Where the Market Intelligence features (comp band, target list builder, insider network, contact data, board and advisory) go is not shown anywhere. Not found in any mockup.
- **The member's grade** has no mockup place. Candidates today: the "Read the full report" link in the "Your market" mockup (it shows a "B+ This week's market grade", see section 4), and Home > Effort and results (`/dev-preview/home/progress/built`, which replaces stats and already says "badges and leaderboards removed"; it does not mention the Market Reality card).
- **Home note:** `home-note.ts` has `report_ready` (priority 3, after coaching form and strategy setup). That is the only Home hook. Good fit as a one-time note, "Your market read is ready".
- **Weekly email:** the mockup `/dev-preview/moments/weekly-email` has effort, what came back, Candidate+ progress, one thing to try. No grade. The weekly grade snapshot has no slot in it, which is right.
- **Candidate+/Dossier:** `countAGradeWeeks` (dossier-sections) and `GAP_CLOSER` read snapshot grades; `evidence-signals.ts` reads them too. The decisions say the Dossier is "progress, never a lock" and effort earns Candidate+. A-grade weeks count toward Dossier evidence, which ties unlocks to a judgment. Check before keeping.

## 3. Conflicts

Page contract and decisions are in `docs/candidate-redesign.md`. Severity: H high, M medium, L low.

| # | Sev | File | Rule broken | What to do |
|---|---|---|---|---|
| 1 | H | `grade.ts` `GRADE_RECRUITER_IMPRESSION.F` and `.D`; used by `ScoreRevealSection.tsx` (`/onboarding/score`) | Always positive. "weaknesses serious enough to end most conversations before they start" and "more weaknesses than strengths" are member-facing verdicts. | Remove from member copy. Rewrite as what to do next, or drop the reveal. |
| 2 | H | `grade.ts` `GRADE_INTERVIEW_ODDS` ("Typically 100+ applications and 25+ outreach messages per week" for F; A: "~5-10 applications") | Promissory and discouraging. Numbers are labelled "directional estimates, not calibrated" in the code comment but state no source on screen. Also contradicts the prompt rule in the generator (below). | Drop, or replace by a number from the member's own logged search. |
| 3 | H | `market-reality/page.tsx` "Where you stand": letter `A..F`, red `D`/`F` (`GRADE_TEXT_COLOR`), `GRADE_LABEL` "Average", "Room to grow", "Biggest opportunity"; "Candidates at your starting point typically need about N applications or M conversations to generate one interview" | Grades read as judgments; shows a negative score; "every claim says why" (the N comes from a band midpoint, `BAND_MIDPOINT`, "not fit to real usage data" per `probability.ts`). The `EstimateTag` is a small badge-like pill, and "no badges" applies. | Do not show A-F. Show the facts: applications and conversations logged, replies, interviews (as the Effort and results page does). If a number stays, state its basis in the sentence. |
| 4 | H | `stats/page.tsx` (Market Reality card, grade tile, "moved C to D", week-by-week summaries) and `DashboardTopStrip.tsx` grade tile | A grade that can fall is shown on Home and Effort and results. Duplicates the grade on three pages (Home strip, Stats, Report). | Remove the grade from Home and Effort and results. Say what was removed when you add anything (the contract). |
| 5 | H | `market-reality-report.ts` generator prompt (tone `significant_climb`; weaknesses framed as an "accountability mirror"; "hill to climb"; "pivoting is genuinely harder"; a `very_positive` tone "still requires 2 sentences of real friction") | Always positive; one headline per page; also internally inconsistent: the same prompt says "never state or imply a probability of being hired" while the page prints interview odds and calls it "estimate of your per-attempt odds of landing an interview". | Keep honesty, drop the verdict framing. Rename sections ("Areas for improvement" can stay; "hill to climb" and `significant_climb` go). Remove the odds sentence from the page or from the prompt, not both versions. |
| 6 | H | `market-reality/page.tsx` | Page contract: 13+ visible sections, a long page with headings, printed report. Three sections at most. Pages merged into one long page must be split by purpose. | Split (see step 4 in section 6). |
| 7 | M | `dev-preview/_mockups/jobs-more.tsx` `MarketYours`: "B+", "This week's market grade", "A good market for you, and improving", "Medium: How many apply, estimated" | (a) "B+" is not a real grade; `Grade` is A to F with no plus. There is no weekly "market grade" field; `marketScore` exists but is a cap input, never shown. (b) A grade reading as a judgment of the market. (c) "How many apply, estimated" is a bare competition claim with no basis; `jobs/competition.ts` scores single jobs from listing facts, not a market. | Replace the tile with "111 jobs fit you, up 8 from last week" (both numbers are real: `market-size` counts and trend). Drop "Medium" or state the fact it rests on. |
| 8 | M | `market/page.tsx` "Worth knowing" and `MarketFlagsCard` (amber `AlertTriangle` card on Home dashboard when a market is narrow, shrinking, AI-exposed) | Always positive; a warning card on Home breaks "one note per page, only on Home". "Shrinking" is sourced (relative share, 14 v 28 days), which is good, but the framing is a warning. | Turn each flag into "what you can do": the widening options already on the page. One line of fact, one action. |
| 9 | M | `market/page.tsx` trend `-12%` in warning colour | Negative number shown in warning colour. | Neutral colour; say what it compares to. The text under it ("Your level and one below") does name the basis; keep it next to the number. |
| 10 | M | `market-intelligence/page.tsx`: five Cards, several `LockedFeature` blocks, tier label "Your current access level" | Dossier and Candidate+ "never as a lock"; the contract's three sections; "no row more than a title, a verdict, a fact, two actions". Locks conflict with "once earned, nothing looks locked" and the one unlock ladder. | Show only what is available; move tiers to Membership. |
| 11 | M | Weekly grade cron, `generateMarketRealitySnapshot`, `MARKET_REALITY_COMPLETE` badge, and the report email subject ("You earned a badge, and your Market Reality Assessment is ready") | "No badges" (what-you-asked-for item 27 is "Not done"). The badge email is the one the weekly progress email replaces. | Remove the badge line from the report email. Keep snapshots as internal history only (also used by the monthly report). |
| 12 | M | Monthly member report `build.ts` "Members whose grade fell" | Internal only, so no member-facing conflict. But it reads `MarketRealityComponentScore.grade` (the composite starting band) while snapshots store `probabilityGrade`. Two different grades are compared in one report. | Pick one; if the grade goes away from member pages, define the internal one and name it. |
| 13 | L | Unsourced claims: `AreaBriefView` fine ("Open roles on the NextChapter job board... Not the whole market" is a model sourced line); `market-intelligence` "built from real NextChapter data, not a resold data license" | Marketing claim that the member cannot check. | Remove the sentence or add the source. |
| 14 | L | `market-reality/page.tsx` shows `EstimateTag` and explainer `GradeSystemExplainer` ("We're hard graders on purpose") | Tone: contradicts "always positive". | Delete with the grade. |
| 15 | L | Naming collision: member "Market Reality Report" vs public "Employment Report" vs "monthly report" (member monthly report, and `admiring-johnson` routine for the public monthly Employment Report) | Terms stay consistent. | Name them: "Your market" (member), "Employment Report" (public), "Monthly member report" (admin). |
| 16 | L | Branches `employment-report-*` | Superseded naming (`employment-report-` slug vs main's `white-collar-employment-report-`). Merging would revert main. | Do not merge. Take only `hero-stats.ts` (sourced stat model) and the publish checklist, rebased. |

Things that conform: the report email's "Email me this report" requires no scoring; `getGapReframingContent` for F ("targeting mismatch, not a volume problem") is constructive in intent but its trigger is the F grade itself, so it disappears with the grade (see section 4 below); the generator already forbids ranking schools or employers and consolation words; the page keeps blockers and motivations out of the grade (privacy rule is documented in `probability.ts`); the recruiter and hiring-manager reports never receive the grade (stated in `probability.ts`; I did not read `recruiter-report.ts` to confirm).

**Does it break "always positive"?** Yes, in conflicts 1 to 5 above. The code authors held to a different rule: `docs/specs/NextChapter_Report_Structure_Spec.md` says "the score is a difficulty estimate, not a verdict" and the code blocks "manufactured warmth". The redesign's rule is different: honest facts, shown as progress, no letter.

## 4. Old or does not fit

- The six-category "Your Grades" breakdown (`dossierGradeAtGeneration`): the page comment itself calls it dead code, never populated.
- `snapshot.dimensions` is written as an empty array (comment in `market-reality-history.ts`).
- `composite.ts` Evidence and Effort components: computed and stored but excluded from the grade; used only for analytics.
- Track Record (19 items) and What I Need (24) are "not read anywhere" per `docs/personalization-audit/README.md` rows 87 and 88, but are named as inputs in older reports. Do not depend on them.
- `docs/candidate-feature-map.md` line 39 calls `/dashboard/market-reality` "buried"; the redesign is the chance to decide, not to resurface it.
- `employment-report-phase1` to `-followup` (rename to `employment-report-`): superseded.
- `stats-sept-2026`: homepage stat changes are Sept; today is Oct 18. Likely stale; the October edition exists on main (`october-2026` slug appears in the routine prompt). Not verified.
- Market Intelligence "Contact data" shows "No data provider connected": an empty state for a feature that does not exist.
- `Is learning AI critical to staying in your field?` on Market: a question heading with an AI-exposure label; sourced, but off the Jobs purpose. Consider Learn.

## 5. New ideas

1. **"Your market" as the one headline**: "111 jobs fit you this week, 8 more than last week." Sentence under it names the basis ("open on the NextChapter board for Director of Operations, New York and remote"). Primary action: "See the 8 new jobs". It replaces the grade tile in the mockup.
2. **Interview math from the member's own log**: "You have logged 18 applications and 11 conversations; 3 led to a reply." Replace `rubric` (band midpoint) with real counts. Honest, positive (progress), sourced to the member.
3. **Gap to a better market, not a grade**: reuse `getGapReframingContent` as "Where you could widen" for anyone whose targeting is thin (the same data as pivot paths and market-size expansions), no F required.
4. **Weekly email line**: one fact from market-size ("6 new roles at your level in Boston this week") as the "one thing to try" source. No grade in the email.
5. **Sourced stat pattern**: adopt `hero-stats.ts` (value, label, tone, source, url, evidence tag) as the claim model for every figure on Market and pay, with the publish checklist's balanced-wording rule.
6. **Layoff news as an opt-in note** in Local market for members who were laid off (Finances and benefits already has that journey), not a dashboard card.
7. **Resume fixes and ATS matrix** are the most useful parts of the report and fit Jobs > Résumé (`/dashboard/resume`) with "why" lines; the report page needs not carry them.
8. **Print/share**: keep "Email me this report" as the one action on a slim "Your market read" page.

## 6. Incorporation steps, in order

1. Decide with the owner whether any A-F letter stays visible to members. Everything below follows. My recommendation: no letter on any member page; keep `probabilityGrade` as an internal input (Dossier, monthly report, calibration).
2. Fix the redesign mockup first (it is where the owner reviews): in `jobs-more.tsx` `MarketYours`, replace "B+ / market grade" with the jobs-that-fit count and the weekly change; remove or source "Medium". Screenshot it. Add one mockup for the report page (a "Your market read" page, at most three sections).
3. Define the Market and pay entry in the tabs: Part 1 "Your market" (count, trend, widening), Part 2 "Know your worth", Part 3 "Local market". Decide where the Market Intelligence pieces go (comp band into pay; target list into Companies; insider network into Network; drop contact data and board until real). Update `docs/candidate-mockups.md` rows.
4. Split `/dashboard/market-reality`: move "What to fix on your resume", "How a recruiter will read this", "Getting past the filters" under Jobs > Résumé; move Rejection Patterns, Application Trends and What's My Pattern to Home > Effort and results as one "Your search timeline" section; keep Executive Summary and Next steps as a short "Your market read". Say in the change what each page removes.
5. Remove the grade from `DashboardTopStrip` and `stats/page.tsx`; remove `MARKET_REALITY_COMPLETE` from the badge list; remove the badge line from `send-market-reality-report.ts` and the "grade moved up" email, or fold them into the weekly progress email once built.
6. Rewrite member-facing copy: delete `GRADE_RECRUITER_IMPRESSION`, `GRADE_INTERVIEW_ODDS`, `GradeSystemExplainer`, `EstimateTag` from member pages; edit the generator prompt (drop `significant_climb` tone and "hill to climb"; keep the honesty rules; reconcile the "no probability" rule with the page). Regenerate sample report.
7. Market flags: turn the Home `MarketFlagsCard` into the Home note when it matters (`home-note.ts`, new kind or fold into `report_ready`), one line of fact, one action.
8. Recast `market-intelligence`: no `LockedFeature`; show only what the member has.
9. Per the analytics rule, fire PostHog events for any new action (for example `market_widening_added`, `market_read_emailed`) with `{ candidateId, roleKey, surface }`.
10. Ignore the four `employment-report-*` branches. From `stats-sept-2026` take only `docs/report-publish-checklist.md`; from `employment-report-phase3` take only `hero-stats.ts` if the homepage is still to be updated. Decide whether `ccr-4081de5b-or2tsf` (layoff news) merges now: it needs a rebase (271 behind) and only improves Local market data. Add the naming line from conflict 15 to `docs/`.
11. Re-run `src/test/scoring-fixtures.test.ts`, `grade-boundary-consistency.test.ts`, `market-reality-probability.test.ts` after removing any grade copy; several assert tonal consistency of `DIFFICULTY_LABEL`.

## Not checked
- Whether `recruiter-report.ts` and `hiring-manager-report.ts` actually exclude the grade (only the comments say so).
- `src/emails/market-reality-report.tsx` copy (the file was not read; only the sender).
- `AreaBriefView` layoff counts and the live ones against the layoff-news branch.
- The November report data; the October Employment Report content.
- Any production data (how many members have D or F).
