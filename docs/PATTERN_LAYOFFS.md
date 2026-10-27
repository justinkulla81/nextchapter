# Pattern: layoffs (WARN Act, company layoffs, risk check)

The COBRA vs ACA pattern (researched rules in one data file, an ungated explainer, entity pages that pass the thin-page bar, a free
tool, a journey hand-off and an email box, events, a funnel row) applied to the data only we hold: WARN notices and the layoff tracker.
Written 2026-10-27. Every claim has its source; what could not be sourced is listed at the end.

## Demand evidence (Google autosuggest, 2026-10-27)

Read from `https://suggestqueries.google.com/complete/search?client=firefox&q=<seed>`. Autosuggest shows what people type, not volume.

| Seed | Suggestions that matter |
|---|---|
| `warn notice` | warn notice nj, ny, nyc, california, ct; "warn notices by state"; "warn notice nj 2026"; "warn notice prudential" |
| `warn notice texas` | texas 2026, requirements, list, gov, plus company names (texas instruments, amazon, conocophillips) |
| `what is a warn notice` | for layoffs, "what is a layoff notice", "what is a warn notice period", and state versions (NJ, CA, TN, IN, OH) |
| `warn act 60 days` | severance, pay, "california warn act 60 days", "60 or 90 days", "warn act timing" |
| `layoffs 2026` | tracker, usa, reddit, tech, "vs 2025", and companies (verizon, oracle, centene, amazon) |
| `am i going to be laid off` | reddit, "signs i am going to be laid off", "can you be laid off for no reason" |
| `signs of layoffs` | coming, at work, early signs, warning signs, mass layoffs |
| `layoff risk` | "layoff risk calculator", "layoff risk assessment", "my layoff risk", "meta / microsoft / citi layoff risk" |
| `layoff checklist` | for employees and employers, SHRM, Meta, Amazon |

Search Console already shows one: "layoff risk assessment" (7 impressions in 3 months).

## Who ranks, and what they lack (live search, 2026-10-27)

- **State WARN lists and counts:** Kadoa ("Layoffs by State": California 15,426, Illinois 4,749, Georgia 3,925, all-time), LayoffAlert
  (2,100 notices and 208,744 employees through June 2026 for 42 states; a homepage figure of 6,516 notices and 717,623 employees for 12
  states), layofftracker.us (3,067 notices and 276,521 workers in 2026), USA Today's tracker, Boston Globe (Massachusetts).
  **Their totals disagree with each other** because they cover different periods and state sets, and none defines its unit beside the number.
- **"Am I next?" tools:** Layoffhedge ("Am I Next?", a 0 to 100 score from industry, role type, company size and tenure weighted against its own
  tracker, with a "not a prediction" disclaimer), several syndicated "Workday insider calculator" posts with no method, a narrative page, and
  a startup-offer checklist. None uses an employer's own filing history alongside an occupation-level AI exposure source, and none shows
  each sign with its threshold.
- **WARN Act explainers:** law-firm and HR sites (Fisher Phillips, Thomson Reuters, HR Cloud, Pennsylvania L&I) in employer-compliance terms.
  Few speak to the worker, and fewer trace each rule to the statute and show the state laws side by side.

## The angle where we can win

1. **The citable record, with definitions.** Every number on the layoff pages now has a unit, a definition and an as-of date, and the page
   that prints it shows how it ties to the downloadable file. Competitors' totals disagree and say nothing about why; ours can be quoted.
2. **The worker's side of the notice.** The company pages now say what a WARN notice means for someone who works there, in plain language with the rule sourced.
3. **A risk check that shows its work.** Five signs, each a yes or no with the threshold written down, the employer's own filing history as an input
   (data competitors do not have), AI exposure from the Anthropic Economic Index, and an honest list of what it cannot see.

## What shipped (this PR)

- `/resources/warn-act`: ungated explainer, federal rule, five state laws, FAQ with structured data, sources.
- `/layoffs/by-state`: one table per state (notices, workers named, latest, CSV), the unit defined, a citation line.
- `/layoffs/company/<slug>`: a "What this means if you work at X" block with the employer's own numbers (notices on file, last 12 months, months with a filing, states).
  Median 473 words and 32 numbers across a sample of 12, up from 272 and 10 (page-quality bar: 250 words, 5 numbers, under 0.80 similarity; maximum similarity 0.62; 12 of 12 pass).
- `/tools/layoff-risk-check`: client-side check, no AI, no stored data, one employer lookup (`/api/layoffs/employer-lookup`).
- "How we count" block on `/layoffs`, `/data` and `/layoffs/by-state`, from `src/lib/warn/layoff-definitions.ts` and `layoff-counts.ts`.
- Funnel row "Layoff risk check, WARN Act guide and state index" on the admin funnel page.

## Numbers reconciled

| Number | Before | Now | Why |
|---|---|---|---|
| Workers in 2026 layoffs (`/layoffs`) | 637,659 | 303,959 | 128 announcements with no U.S. state (335,448 workers) were counted: Volkswagen 100,000, a foreign government 25,000, UBS 12,000, Wipro 6,716, and rows whose "employer" was a headline fragment ("AI blamed for", "AI"). The tracker queries now keep only rows with a U.S. state. |
| Layoffs in 2026 (`/layoffs`) | 2,112 "layoffs" (all time since March 2025) | 1,995 for 2026 | Labelled by year, same grouping rule. |
| Notices (`/data`) | "3,200 notices" | 3,206 filings, last 24 months, 368,396 workers | Called filings, one row each, and shown next to the grouped layoffs figure with both definitions. |

The 128 excluded rows are still in the database. They were not deleted. Some are clearly not companies and should be reviewed by a person
(employer text like "AI blamed for" with 112,713 workers and "AI" with 5,000): see the list at the end.

## Sources read (2026-10-27)

Federal text: 29 U.S.C. 2101, 2102 and 2104 and 20 C.F.R. 639.5, 639.7 and 639.9, from the Legal Information Institute copies
(the official U.S. Code and eCFR sites block automated readers). U.S. Department of Labor WARN page.
State: California EDD (read in full), New Jersey (amended statute PDF and the state's business update, via search), New York DOL page and fact
sheet (via search), Illinois Department of Labor and ILCS (via search), Washington ESD (via search). Risk check: Anthropic Economic Index
(`data/aei`, CC BY), Zety Repeat Layoff Index as reported by CPA Practice Advisor (March 25, 2026: 1,031 U.S. tech companies, 27% with two
or more rounds, 70% of repeats within 12 months; commercial, tech only, not peer reviewed). All URLs and the "used for" line are in
`src/lib/warn-guide/rules.ts`. State pages marked "via search" were summarized from search results and should be re-read from the page itself.

## Left out, and why

- **Other states' WARN laws.** Only five were sourced. The page says so and points to state labor departments. Adding a state means adding a sourced entry.
- **Tenure in the risk check.** The BLS displaced-worker tables found cover long-tenured workers only, and nothing found ties tenure to selection in today's cuts.
- **Company size as a score.** WARN covers employers of 100 or more, so small employers are invisible, not safe. Size is asked only to warn about that.
- **Pay in lieu of notice, and every part-time entitlement question.** The regulation sections read do not address them; the FAQ says so.
- **A validated model.** The five thresholds are our judgment. They have not been tested against who was laid off, and every result says so.
- **Official-site copies of the federal text.** eCFR and uscode.house.gov blocked the reader; LII was used.

## Email switches

- New-notice alerts on the risk check and the WARN guide reuse the existing layoff alert signup (`saveLayoffAlert`, a `HomepageLead` of kind `layoff_alert`,
  confirmed by email before anything is sent). Whether a confirmation email goes out is controlled by `LAYOFF_ALERT_EMAILS` (off). Nothing was switched on.
- The journey hand-off sends no email.

## Data to review by a person

- WarnNotice rows with no state and a headline fragment as the employer ("AI blamed for", "AI"). Dismiss or fix them in the admin.
- The 216 reported rows that do have a state are mostly real company layoffs (Oracle CA 21,000, Amazon WA 16,000, Dell TX 11,000); a person should spot-check the largest.
