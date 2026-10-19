# Audit: finding future opportunities (not posted yet, where jobs will be)

Read-only audit, 2026-10-18, by reading code and branches (nothing run). Checked against `docs/candidate-redesign.md`, `docs/candidate-mockups.md`, `docs/personalization-audit/`, `docs/what-you-asked-for.md`, `src/lib/nav/redesign-places.ts` and the mockups `jobs-find.tsx` and `jobs-more.tsx`.

## 0. Status at a glance

| Piece | Where | In main? |
|---|---|---|
| Likely openings: SEC 8-K Item 5.02 (officer leaves or is named), Form D (funding), Haiku second read, news-report signals for private companies | `src/lib/likely-openings/*`, cron `/api/cron/likely-openings`, admin `/support/admin/likely-openings` | Yes (commits 2026-10-09 to 10-13) |
| "Likely openings - not posted yet" section on the job board | `src/components/dashboard/LikelyOpeningsSection.tsx`, rendered at `find-my-job/page.tsx` line 1660. Live: https://launchyournextchapter.com/dashboard/find-my-job | Yes |
| Same signals in the daily email ("Job Search Daily") | `src/lib/job-search-daily/build.ts` (top 2 with a reason), `src/emails/job-search-daily.tsx` | Yes |
| Signals on the company page and Company Tracker | `src/lib/likely-openings/for-companies.ts`, `CompanyIntelPanels.tsx`, `src/lib/company-tracker/watchlist.ts`. https://launchyournextchapter.com/dashboard/companies | Yes |
| Company signals and hiring index (posting trends, hiring volume, contracting) | `src/lib/companies/signals.ts`, crons `company-signals`, `company-hiring-index`; "Moves at companies you track" in the daily email | Yes |
| Layoff tracker: WARN notices, SEC 8-K, layoffs.fyi, news check, CHRO and primary contact | `src/lib/warn/*`, crons `warn-sync`, `layoff-news`. Candidate sees counts on https://launchyournextchapter.com/dashboard/companies and https://launchyournextchapter.com/dashboard/local-market | Yes, daily |
| Layoff news every 3 hours, Google News as a second source, company matching, dedupe | `origin/ccr-4081de5b-or2tsf` (2 commits, 11 files; 271 behind main) | Branch only |
| Federal contract awards per company (USAspending) | `src/lib/companies/federal-contracts-sync.ts`, cron `federal-contracts` | Yes |
| Market intelligence (Candidate+ weekly brief, target list, warm paths, decision makers, comp bands) | `src/lib/market-intelligence/*`, https://launchyournextchapter.com/dashboard/market-intelligence | Yes |
| Funding opportunities (Grants.gov, SAM.gov, foundations; Workforce Pell, dislocated worker, AI workforce) | `src/lib/funding-opportunities/*`, cron `funding-opportunities`, admin CRM `/support/admin/crm/funding` | Yes, **admin and sales only** (money NextChapter or partners pursue). Not a candidate feature |
| Job competition score ("Likely fewer applicants" with reasons) | `src/lib/jobs/competition.ts` | Yes |
| Ghost-job risk, click-time liveness check, crawler liveness | `src/lib/jobs/ghost-risk.ts`, `liveness.ts`, `liveness-store.ts`; branch `job-liveness` | Yes (`job-liveness` is an ancestor of main) |
| "May have closed" note and "This job is closed" button on aggregator-only jobs | `origin/job-agg-flag` (1 commit, 3 files, 0 behind main) | Branch only |
| Fresh-job alert email (very strong fits, within 24h, max 2 jobs) | `src/lib/jobs/fresh-job-alerts.ts`, cron `fresh-job-alerts`; off unless `FRESH_JOB_ALERTS_ENABLED=true` | Yes (flag) |
| Alert runs every 3h in US daytime, serializable one-per-24h cap | `origin/hot-alerts` (`fresh-job-alert-cap.ts` + test) | Branch only |
| Fresh-jobs peek (nav badge, Home prompt: new in last 72h in your function) | `src/lib/jobs/fresh-jobs-peek.ts` | Yes |
| Backchannel email (you applied, you know someone there) | `src/lib/email/backchannel-note.ts`, `send-backchannel-match.ts`, cron `backchannel-match` | Yes |
| Backchannel: rank by email, warmth, role fit, plus a rotating sourced "why" stat (Lever/SHRM, NY Fed/MIT, MIT/LinkedIn) | `origin/claude/peaceful-mccarthy-9xrnls` (1 commit, 7 files, 41 behind) | Branch only |
| USAJOBS import (open-to-public, last 30 days, up to 6 pages of 500) into the ATS feed | `origin/ccr-b95b42bd-iwp0b6` (`src/lib/jobs/usajobs-feed.ts`, 319 behind main) | Branch only |
| Jobs report: crawler and employer sources by city (Pittsburgh, Louisville, Charlotte, Cincinnati, Columbus, Indianapolis, Memphis, Nashville), stats edge function, BLS peers | `origin/claude/exciting-johnson-lcf7h8` (26 commits, 40 files, mostly `scripts/jobsreport/`, `docs/jobs-report/`) | Branch only |
| Crawler taxonomy: seniority rules from the Amazon, Walmart and UPS crawl check | `origin/crawler-big3-taxonomy-2026-10-17` (1 commit, 2 generated files) | Branch only |
| AI skills layer: 16 AI skills, gap view on Learn, 131 lines of course additions | `origin/ai-skills-taxonomy` (14 files, 15 behind) | Branch only |
| Geography, economic-development leads, pitch decks | `origin/geo-pitch-1008` (admin CRM only; 519 behind main) | Branch only |
| Local market | `src/app/dashboard/local-market/page.tsx` (area brief, layoffs filed, who is hiring, local news) | Yes |

Not found: any branch named `job-agg*` other than `job-agg-flag`; any "leadership change" code outside likely-openings (it is the same thing: `EXEC_DEPARTURE`, `EXEC_APPOINTMENT`, `FUNDING_RAISE`).

## 1. What it is, and where it lives

**One idea, four feeds.** The owner's session built a way to say "a job is probably about to exist" from public facts.

1. **Executive departure** (`EXEC_DEPARTURE`, labelled "Likely opening"): an 8-K Item 5.02 says a CEO, CFO, COO, CTO, General Counsel and so on is leaving. 14 officer roles, each mapped to functions (`ROLE_FUNCTIONS`).
2. **New leadership** (`EXEC_APPOINTMENT`): a new chief usually rebuilds the team under them.
3. **New funding** (`FUNDING_RAISE`): Form D filings, filtered to exclude pooled funds, SPVs and real-estate vehicles.
4. **News signals** for private companies with no filings (`cik = "news"`), officer seats only. Signals live 120 days (`SIGNAL_TTL_DAYS`).

A rules parser reads the filing, then Claude Haiku (about $0.003 per filing, cached per accession number) re-reads the ambiguous ones (division president vs company president, merger boilerplate). Each signal links to the filing or report ("Read the SEC filing", "Read the report").

**Ranking for a member** (`for-candidate.ts`): watched company +100, applied company +60, target/primary/secondary function fit +40/+30/+15, level fit, deal size, freshness. One signal per company. Signals with no company tie and no function fit are dropped. The "reason" is plain text ("On your Company Tracker", "You applied here", "Fits your finance background").

**Beside it** are the "where jobs will be" signals: layoff notices (WARN, 8-K, layoffs.fyi, news), company posting trends and hiring index, federal contracts, area brief, and market intelligence for Candidate+. And the "get there first" signals: fresh-job peek, fresh-job alert, USAJOBS feed, backchannel email.

## 2. Where it fits the redesign

The redesign has no "future" place. It belongs inside **Jobs** and **Network**, never as its own tab. Mapping:

| Source | Surface in the redesign | How it should show |
|---|---|---|
| Likely openings (departure, new leader, funding, news) | **Jobs, Find a job, "Not posted yet"** (`/dev-preview/jobs/find/unposted`, replaces "Likely openings on /dashboard/find-my-job") | One row per company: the fact ("The President retires December 31 and no successor is named"), who you know, one action, filing link. This is already in the mockup and matches the data model one to one. |
| Same signals, "who you know" | **Network, People you know** (`network/circles/know`): "Each person comes with a reason to reach out today" | A contact's reason can be "works at Lemaitre, where the President retires". This is the contacts-first suggestion. It needs the warmth ranking from backchannel (see below). |
| Backchannel (applied job, you know someone) | **Network, People you know**, and **My jobs** next-step line ("You messaged Priya Shah. Wait for her reply.") | Same contact matcher as "Not posted yet". One matcher, three surfaces. |
| Company moves and company signals (posting trend, hiring volume) | **Jobs, Companies** ("Worth watching": "Hiring 4 operations leaders. Your field.") and **Company profile** | Fact line only, with the number it rests on. |
| Likely-opening signals for a watched company | **Companies, Watching** row, and **Company profile** | Show the one signal for that company with its filing link; do not repeat it in Not posted yet when the company is watched (or show it in one place and link). |
| Layoff notices (metro, company) | **Jobs, Market, Local market** (`jobs/market/local`) and **Company profile** as a caution | "Filed layoff notices in your metro" with the notice count and the date range. For a member whose company laid off, this is also the Finances and benefits trigger (not this session's job). |
| Competition score | **Find a job** row and detail ("How many people will apply") | Already in the mockup with reasons. Keep. |
| Fresh jobs (peek, alert, daily) | **Home note** (one note only) and the Find a job list sort | See conflicts: pick one source. |
| USAJOBS | **Find a job list** as ordinary rows (no new tab or filter) | Federal jobs have a different process (resume format, hiring path). Say so in the detail. |
| Job liveness and "may have closed" | **Find a job detail**, one quiet line | Not a row-level button. |
| Market intelligence (weekly brief, target list, warm paths) | **Jobs, Market, Your market** for the summary; Candidate+ gating stays | Each brief line must trace to a real fact (the code already says so). |
| Local market and area brief | **Jobs, Market, Local market** | Already mapped. |
| Jobs report (crawler and employer sources by city) | **Not a candidate surface.** Feeds Local market with "who is hiring" and the partner and press reports | Candidate view is only the employer list with job counts. |
| AI skills layer | **Learn, Skills and courses** ("what AI skills your best-fit jobs ask for") | Fits "Closer to hired". Also Market, "other roles". |
| Funding opportunities, economic-development leads, pitch decks | **Admin and partner side** (workforce boards, higher education), outside the candidate redesign | Leave out of the candidate menu. |

## 3. Conflicts

### 3a. With the redesign rules

1. **"Likely openings" has no number or consequence.** The mockup says "Fresh funding usually means senior hires in the next few months." The code does not state any rate. Rule: a claim says what it rests on. Fix: say what happened ("Raised $547M on September 30, per Form D") and drop "usually means ... in the next few months" unless a sourced figure is attached. The departure rows are safer ("retires, no successor named" is a fact).
2. **Estimates without a source.** `competition.ts` is an honest rules score ("every point is a reason"), good. But the **Market** mockup shows "How many apply, estimated: Medium" as a bare tile, and the Home/Companies copy "Low competition" must never be bare. Keep "Likely fewer applicants" only with its reasons (the mockup detail does this; the row line "Posted 34 hours ago · Likely fewer applicants" does not state which fact). Row rule: a competition claim states the fact it rests on, so write "Few applicants: a search-firm role that is not on the big boards" on the row, as the contract shows.
3. **Wage and "up 8 from last week" in Market mockup** are sample data, not from this session, but the same rule applies if they are wired from the market code.
4. **Row budget (rule 5: title, one verdict with reason, one fact, two actions).** `job-agg-flag` adds a warning paragraph plus a "This job is closed" button to the job card. That is a third element beyond the fact and two actions, on rows people see all day. Move to the detail pane, as one line: "Listed on an aggregator, so it may have closed."
5. **Chips.** The Not posted yet mockup shows a signal chip ("Leadership change") per company. A chip is a tag; the rule says a change that adds a tag must say what it removes. Replace the chip with the fact sentence (the row already says it). Same for the "Likely opening / New leadership / New funding" pill in the live section.
6. **Legal credit.** O*NET and BLS credit must be one line linking to the full notice. The mockup has it on Resources; the real pages with BLS figures (Pay, Market) need it too. SEC data needs no legal credit but each row should keep its source link ("Read the SEC filing"). The backchannel stat sources (Lever via SHRM and others) are cited already.
7. **One note, only on Home.** The "Likely openings" explanatory paragraph at the top of the live section, and the "reach out now, before there's a posting and a crowd" line, are page notes. In the redesign this becomes the one-line intro under "Not posted yet", nothing else.
8. **Primary action.** In the mockup only the first row has the primary button. The rule is one primary action per page, so keep the first as primary only if it is truly the best row; the others are secondary (already done).
9. **Contacts first** was promised (`what-you-asked-for.md` item 23, "Still open"). The live `LikelyOpeningsSection` shows no contacts. The mockup's "Who you know" line has no code behind it yet. The backchannel branch contains the ranking to reuse (`rankBackchannelContacts`).

### 3b. Duplicated or competing sources

1. **Fresh jobs have four voices:** the nav badge and Home prompt (`fresh-jobs-peek`, 72 hours, own function), the fresh-job alert email (24h, very strong fits, max 2, flagged off), the daily email's fresh section (`freshJobItems`), and the job board "Posted today" sort. Plus `hot-alerts` would send the alert up to several times a day. One rule on cooldown (one per 24h) keeps it from spamming, but a member can still get an alert, a daily email and a Home prompt about the same job in one day. The alert already skips jobs shown in Job Search Daily; the reverse is not guaranteed. Decision needed: Home note is the one place; one email carries them.
2. **Likely openings appear in three emails/places:** the job board section, the daily email (top 2) and the company page and tracker. Fine as data, but in the redesign it should be one list plus the company profile line.
3. **Backchannel email plus daily email plus fresh alert plus weekly email** (`moments/weekly-email`): that is up to four candidate emails about "someone you know" and "new job". The redesign says one note per page and a single weekly email. The backchannel email is the only one that is event-driven and specific; keep that, but make it a note on Home and My jobs, and let the weekly email carry the rest. At the least, do not send backchannel and "Not posted yet" nudges for the same company.
4. **Layoff data is recorded three ways:** `warn-sync` (daily), `layoff-news` (every 3h, after the branch merges), and `sec-8k` inside `warn`. The branch dedupes layoffs.fyi against news but leaves the 8-K layoff reader (`warn/sec-8k.ts`) and the likely-openings 8-K reader (`likely-openings/parse-8k.ts`) separate, both reading 8-Ks. Same filings, two parsers, two tables, no shared accession cache. Share the cache (`SecFilingRead`) and the EDGAR client.
5. **Stale comment:** `src/app/dashboard/companies/[slug]/page.tsx` line 335 says no WARN monitoring exists anywhere in the codebase. It does now. The card was removed; either bring back a "Filed layoff notices" fact line there or fix the comment.
6. **Ghost risk, liveness and competition** are three separate lenses on "is this real and how crowded". The row can only carry one fact. Ghost "likely" is already kept off the board; "watch" shows no credit. Do not add a ghost chip to the row.
7. **USAJOBS** creates `source: ats_feed` rows. `job-agg-flag`'s `reportJobClosed` only acts on `source === 'ats_feed'` with an aggregator URL (`aggregatorKind`: Jooble, Careerjet). USAJOBS URLs are not aggregators, so no clash, but USAJOBS postings get a firm close date; the feed should store it and expire them, not rely on a member report.

### 3c. Risks in the branches

- **`job-agg-flag`: one member can remove a job for everyone.** The report closes the posting for all members and tells the crawler not to bring it back. One bad or mistaken click hides a live job. Use a threshold (two members) or a quiet re-check by the crawler before taking it down. Also the button label "This job is closed" should say what it does: "Report this job as closed".
- **`hot-alerts` (282 behind) and `ccr-4081de5b` (271 behind) and `ccr-b95b42bd` (319 behind) are stale.** `vercel.json` and `schedule.ts` conflict surface is high; rebase before merging. `hot-alerts` edits `vercel.json` line 178 area; main has since moved the alert cron to line 212.
- **USAJOBS** needs an API key and user-agent email (`USAJOBS_API_KEY`); check it is read from env and that the import tells the member the job is a federal posting with a different process.
- **Backchannel branch** changes email copy; check it keeps the claim sourced (it does) and that the "why" stat is phrased as the source reports it (it is).
- **`exciting-johnson` jobs report** adds `CLAUDE.md` changes (13 lines) and a GitHub Actions crawl workflow. A branch that edits the project instructions must not merge without the owner reading that diff.
- **Edge function with a token placeholder** (`jobsreport-stats.ts`, `__SET_BEFORE_DEPLOY__`): confirm it is never committed with a real value.
- **Other session's job-card work** (`DiscoverJobCard`, `job-card.ts`, `JobCardParts`): `job-agg-flag` edits `DiscoverJobCard.tsx` in the same spot as the verdict, meta line and "Likely fewer applicants" hint. This will conflict with the redesign of the job row. In the redesign the row is built fresh from the mockup, so the flag must move to the detail pane, not into the old card.

## 4. Old, or does not fit

- **The "Likely openings" section on the old long page** (`LikelyOpeningsSection` inside `find-my-job/page.tsx`, a 2,000+ line page): replaced by "Not posted yet". Keep the data layer, drop the component.
- **The three labels "Likely opening / New leadership / New funding"** as pills: drop in favour of the sentence.
- **`geo-pitch-1008`** (economic-development leads, pitch deck builder, pitch rules): admin sales tooling. It does not touch the candidate site. 519 commits behind main; it may not merge cleanly, and `src/test/company-wall.test.ts` is edited (not read here; check why).
- **Funding opportunities**: not for candidates. If a candidate version were wanted (grants for a venture, for training), it is a separate decision and only fits "Entrepreneur" or "Finances and benefits"; today nothing in it points at an individual.
- **Jobs report scripts** (Python crawlers, Supabase edge function): a reporting pipeline, not a feature. 4,205 inserted lines. Its useful product is the employer list by city for Local market. Do not merge the 40 files into the app repo without deciding where they live.
- **Crawler taxonomy (big3)**: generated file plus fixture. Safe, small, no UI. Merge when convenient.
- **Executive-only focus.** Likely openings only read officer seats and funding rounds. For most members (below VP) the section is empty or noise: the ranking already drops unrelated signals, so a typical manager sees nothing. The mockup's four rows are all C-suite. The redesign needs an honest empty state ("Nothing yet for your field. We watch filings for officer changes and funding, which mostly show senior roles.").
- **"Hide contracting" and company-level signals copy** on Companies explain filters in prose; reduce when the page is rebuilt.

## 5. New ideas (small, each with its why)

1. **Not posted yet, empty state for below-VP members.** Show the nearest real thing: companies on their Watching list with a new leadership change, or "4 of your watched companies posted a new job this week". Why: stops an empty section.
2. **Link a signal to the contact, not just the company.** On "People you know", show "Priya Shah (VP Operations) works at Lemaitre, where the President retires Dec 31." Why: a reason to reach out today is what that page promises, and it uses the warmth ranking built for backchannel.
3. **A "Watch this company" button on every Not posted yet row** that feeds Companies, so the signal turns into "5 new jobs for you" when the posting appears. Why: closes the loop from "likely" to "posted", and lets the product say "it was posted 11 days after the signal" later as a sourced fact.
4. **Measure the claim before making it.** Log signal date and the date a matching job posts at that company (title family match). After a few months, "Of the CFO departures we flagged, N were posted within 90 days" is a fact that justifies the whole section. Until then, do not say "usually".
5. **Layoff notices as a Companies caution, with the date.** "Filed 94 layoffs on September 12 (WARN notice)". Why: a member about to apply or interview should know, and the data exists. Fixes the stale comment in 3b.
6. **Local market gets "who is hiring" from the jobs-report employer lists**, with the count per employer, by city. Why: the sourced employer lists are the only per-city view of who is hiring.
7. **Alumni angle:** the mockup says "2 Ohio State alumni work there". Use the alumni and groups data already in Network for this line.
8. **Federal tab inside Resources, not Find a job:** a short "How federal hiring works" guide (USAJOBS hiring paths, resume format), linked from any federal posting. Why: federal applications fail on format, not fit.

## 6. Incorporation steps, in order

1. **Decide the one-source rule for "new job" nudges** (owner). Recommended: Home note carries the nudge; one fresh-job email per 24h; the daily email does not repeat a job the alert sent (and vice versa); backchannel stays as an event email but never for a company already in the week's note. Record it in `docs/candidate-redesign.md`.
2. **Merge the small, safe branches onto main after a rebase:** `crawler-big3-taxonomy-2026-10-17` (generated rules), `hot-alerts` (cap with tests; rebase `vercel.json`), `ccr-4081de5b-or2tsf` (layoff news every 3h; rebase `schedule.ts`, `vercel.json`, `cron-health.test.ts`), `claude/peaceful-mccarthy-9xrnls` (backchannel ranking and sourced stat). Run the suite for each.
3. **USAJOBS** (`ccr-b95b42bd-iwp0b6`): rebase, confirm env key handling, store the closing date, then merge. Add a one-line "Federal posting" fact in the detail.
4. **`job-agg-flag`:** change before merging: put the "may have closed" line in the detail pane only, require two reports (or a crawler re-check) before taking a job down, relabel the button "Report this job as closed". Do not put it on the row.
5. **Build "Not posted yet" for real** (after a screenshot review of `/dev-preview/jobs/find/unposted`). Data comes from `getLikelyOpeningsForCandidate`. Changes from the mockup: replace the chip with the fact sentence; drop "usually means senior hires in the next few months" unless sourced; add an empty state; keep the filing link; add `source` text ("From a public filing" or "From a news report"). Add PostHog events (`not_posted_yet_viewed`, `not_posted_yet_contact_asked`, `likely_opening_filing_opened` already exists).
6. **Contacts first:** extract the matcher from `backchannel-note.ts` and `warm-paths.ts` into one function `peopleAtCompany(candidateId, companyName)` used by Not posted yet, People you know, Companies and My jobs. Strict name matching (`orgNamesMatchStrict`) as backchannel does: a false positive here tells a real person to contact the wrong company.
7. **Remove the old section** from `find-my-job/page.tsx` when the new Find a job page replaces it, and keep the daily email section (it is the same data).
8. **Layoffs on Companies and Company profile:** one fact line with date and source; fix or delete the stale comment at `companies/[slug]/page.tsx:335`. Share the 8-K cache between `warn/sec-8k` and `likely-openings`.
9. **Local market:** add the per-city "who is hiring" employer list after deciding where the jobs-report crawler lives; do not merge `exciting-johnson` wholesale (40 files, workflow, `CLAUDE.md` edit). Split: docs and employer lists (useful), crawler and workflow (own repo or `scripts/` decision), edge function (token review).
10. **AI skills layer** (`ai-skills-taxonomy`): rebase (15 behind), review the Learn section against "Closer to hired", then merge. It is the cleanest "where jobs are going" fit for Learn.
11. **Leave `geo-pitch-1008` and funding-opportunities in admin.** Handle in the partner redesign.
12. **Measure** after step 5 (idea 4) so the section's claim can become a sourced fact, then change the intro copy.
