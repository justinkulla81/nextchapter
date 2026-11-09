# White Collar Employment Report pipeline

Scripts that produce the data behind the **NextChapter White Collar Employment Report**
(`/reports`) and the **White-Collar Long-Search Index** (`/reports/white-collar-index`).
All figures come from public sources; no NextChapter customer data is used.

## Secrets (`.env.local`)

```
CENSUS_API_KEY=...        # free: https://api.census.gov/data/key_signup.html
SEC_USER_AGENT=NextChapter Research you@yourdomain.com   # a real contact; SEC requires it
```

Both are loaded via Node's `--env-file=.env.local`, the same way the other
project scripts get their secrets.

## `nc_white_collar_index.py` — the White-Collar Long-Search Index

Builds the monthly index from the Census Bureau's Current Population Survey
(CPS) basic monthly public-use microdata and writes the full history to
`public/reports/wc-index.csv`, which the index page reads at build time.

```
npm run report:index
```

Definitions (fixed month to month):

- **White-collar** = labor-force members whose current or most recent job is in
  Census major occupation group 1 (management, business & financial) or 2
  (professional & related) — CPS `PRMJOCC1` in (1, 2).
- **Labor force** = `PEMLR` 1–4; **unemployed** = `PEMLR` 3–4.
- **Long-term** = unemployed 27 weeks or more (`PRUNEDUR` ≥ 27).
- **Weight** = `PWCMPWGT` (the composite weight BLS uses for labor-force estimates).
- **Headline** = WC long-term unemployed ÷ WC labor force, published as a
  **3-month moving average** and as an **index with the 2019 average = 100**.
- All figures are **not seasonally adjusted** at source; the published index is
  seasonally adjusted (factors in the report's methodology). **October 2025**
  was not collected during the shutdown; moving averages skip it.

## `nc_openings_and_aiwashing.py` — monthly companion metrics

Prints JSON with two companion measures:

1. **Senior openings tracker (pilot)** from the local jobs database
   (`$HOME/nextchapter-jobs/data/jobs.db`, public postings only — no member
   data). Compares only sources seen in **both** months so coverage changes
   don't masquerade as market changes.
2. **AI-washing gap** — counts 2026 SEC Form 8-K filings referencing Item 2.05
   (restructuring costs), with and without "artificial intelligence", via EDGAR
   full-text search. Requires `SEC_USER_AGENT`.

```
npm run report:companions -- --month 2026-09 --prev 2026-08 --ytd-start 2026-01-01 --end 2026-09-30
```

## Publishing helpers (TypeScript)

- `npm run report:news` — adds/refreshes the `/news` row for the latest edition
  (idempotent, keyed on `newsSlug`). Requires a database connection.
- `npm run report:indexnow` — pings IndexNow (Bing et al.) with the report URLs
  after a deploy. `npm run report:indexnow -- <url>…` submits specific URLs.

The IndexNow key is served at `public/<key>.txt`; keep `INDEXNOW_KEY` in
`indexnow.ts` in sync with that filename.

## `run-python.mjs`

Small wrapper that runs a Python script with `.env.local` already loaded into
the environment. Not called directly — the `report:index` / `report:companions`
npm scripts use it.

## Early-warning panel (`/reports/early-warning`)

Monthly refresh: `npm run report:early-warning` (U.S. CPS series from 2010 plus the peer-country
file) and `npm run report:ai-layoffs` (needs the database). Outputs land in `public/reports/`
(`us-early-warning.csv`, `early-warning-peers.json`, `ai-layoffs-monthly.csv`) and the page reads
them at build time.

- `nc_early_warning_us.py` — CPS monthly: unemployment, employment rate, long-term share and median
  weeks for all workers, white-collar, graduates 22–27 (bachelor's+), white-collar under 35 and 50+.
- `nc_peer_countries.py` — OECD monthly youth/total unemployment, OECD graduate and duration data,
  IMF GDP growth, Eurostat enterprise AI use (EU) and Census BTOS AI use (U.S.). Python's default
  User-Agent is rejected by OECD and a custom one by the IMF, so the header is set per host. BTOS
  needs `openpyxl`; without it the U.S. AI-use series is left empty.
- The canary test (lead-lag on 12-month changes, 2020-03 to 2022-02 excluded) lives in
  `src/lib/reports/early-warning-analysis.ts`.
- The AI-layoffs series starts October 2026, when the news check began collecting.

## Every edition: standing sections, analyses and questions

Added November 7, 2026 (October edition, versions 1.2 to 1.5). Each monthly edition repeats these; the edition's methodology note
(`data/employment-report/<YYYY-MM>/methodology-note-margins-of-error.md`) documents each one. Editorial rules: balanced (bright spots and
clouds), not political, no claim that AI caused an outcome, no "displacement"/"displaced" in our own wording, month-over-month seasonally adjusted
(and year-over-year where useful), every "larger than" or "differs from" claim tested against a margin or labeled untested, an early-warning section.

**Public CPS files need no API key.** Download `https://www2.census.gov/programs-surveys/cps/datasets/<YYYY>/basic/<mon><yy>pub.csv`
(Jan to latest month, this year and last) into one folder; the scripts below read that folder. Do not read `CENSUS_API_KEY` out of Vercel.

| Analysis | Script | Answers |
|---|---|---|
| Group breakdowns (white-collar, knowledge workers, blue-collar, age, industry, occupation, recent graduates) | `nc_cps_breakdowns.py` | Unemployment rate, long spells, medians, counts |
| BLS-method margins on long-spell shares | `gvf-long-search-margins.py` | Which changes clear their margin |
| Scorecard by industry and age, white-collar vs all workers | `scorecard-margins.py` | Exhibit 4 |
| Month-to-month flows (exit from unemployment, entry) | `nc_cps_flows.py` | Hypothesis: slower exits and fewer entries; validate against BLS published gross flows |
| Reason for unemployment (loser, leaver, re-entrant) and long spells by reason | `nc_cps_reason.py` | Is the rise a shift toward retirees or leavers |
| White-collar by Census division and state | `nc_cps_geo.py` | Where white-collar employment and spells moved |
| Outcomes by AI exposure (AEI score vs CPS occupation groups) | `exposure-outcomes.py` | Are more-exposed occupations losing jobs faster |
| Posted pay: AI-naming vs other postings, across employers, within employer, and employer class | `ai-skill-pay.sql` (whole-board aggregate: run once per edition, keep the result in `data/employment-report/<YYYY-MM>/`, never re-run to adjust a figure; CLAUDE.md egress rule) | Is the AI-skills premium an employer premium |
| Degree-holders by age band, vs no bachelor's | `nc_cps_degree_age.py` | New vs older alumni: unemployment and long spells |
| AI-skill postings by employer industry, outside technology, by function, concentration | one-off edge function (see `ai-skill-pay.sql` notes; query shape in the October 2026 methodology note) | Is AI-skill demand only a tech-company ask |
| Self-employment share and flows from unemployment into self-employment (white-collar, by age) | `nc_cps_selfemp.py` | Is there a move into self-employment; pair with Census Business Formation Statistics (applications, high-propensity, projected formations) |
| Software postings by title, postings by state | `ai-skill-pay.sql` notes | Software demand snapshot; where AI-skill jobs are |

**Also every edition (manual pulls, cite the source and month):**
- BLS payrolls by industry, year over year, from data.bls.gov series pages: professional and business services (and the sub-sectors in the release text),
  information and its parts (telecommunications CES5051700001, motion picture and sound CES5051200001, data processing CES5051800001, software publishers CES5051320001),
  financial activities, health care CES6562000001, federal CES9091000001, construction, manufacturing, retail, leisure and hospitality; state release (gains, losses, DC).
- Indeed Hiring Lab sector and metro postings (`github.com/hiring-lab/job_postings_tracker`, CC BY 4.0): year over year and against February 2020, our more/less-exposed sector grouping,
  software development, large metros.
- Recent graduates (CPS 22 to 27 with a bachelor's degree, plus the New York Fed college labor market page), Stanford Digital Economy Lab, NACE and Handshake as reported.
- Job-search mechanics (applications per job, interview rate, referrals): vendor data, labeled as such; AI-hiring rules (California, Illinois, Colorado, New York City) status.
- Tech: Challenger announced tech cuts against information and professional-and-technical payrolls and computer and mathematical occupations; state plainly that software engineers cannot be isolated.
- Company statements about AI and the workforce (Challenger reasons, SEC 8-K Item 2.05 search, voluntary exit offers) and training programs.
- Findings carried as "our reading, not a finding" until a margin supports them (slow exits and fewer entries; the employer-class reading of the AI pay premium).

**Also every edition:** what the workforce system (rapid response, AJCs, state AI-workforce orders, economic development) and higher education (alumni retraining, career services, value beyond the degree, new vs older alumni) are doing, labeled as announcements unless outcome data exist.

**Questions the report answers every month:** Did hiring improve or weaken, and for whom (industry, age, geography, new graduates)? Are unemployed white-collar
workers staying out longer, and is it slower exits or more job loss? How do white-collar and blue-collar compare, tested? Winners, losers and shifts under the net
change? What happened to tech and software? Are AI-exposed occupations losing jobs faster? What do AI-skill jobs pay and is it the employer or the skill? What are
companies saying about AI and the workforce? What is the job search like (applications, interviews, referrals)? New rules and training programs? Where are jobs growing and shrinking?

## Indicators we track over time (every edition adds a row to `data/employment-report/indicators/`)

New ideas are watched, not asserted. Each edition appends the latest value and its comparison to `watchlist-<YYYY-MM>.csv`, with the source and whether it is official, our calculation or secondary. The Census series are stored in full (`BABATOTALSAUS`, `BAHBATOTALSAUS`, `BAWBATOTALSAUS`, from 2004).

| Area | What we track | Source and cadence |
|---|---|---|
| Entrepreneurship | Business applications (total, high-propensity, with planned wages), projected employer formations, each against a year earlier, February 2020 and the 2021 and 2020 peaks | Census Business Formation Statistics, monthly (next release November 12, 2026, with the annual revision); note the January 2026 definition change |
| Entrepreneurship, CPS | Self-employed share of white-collar workers by age; unemployed workers who are self-employed the next month | `nc_cps_selfemp.py`, monthly files |
| Side work | Share with more than one job; share whose second job is self-employment; Federal Reserve SHED gig and side-work questions when published; private polls only as labeled secondary | `nc_cps_sidework.py`; SHED annual (May) |
| Higher-ed pipeline | Common App applicants (Nov to Mar deadline updates); NSC preliminary fall enrollment (late October) and final (January), by level and field (computer science); persistence and retention (June); completion (December); some college, no credential (spring); time to degree; College Board tuition and net price (fall); NCES degrees by field (annual) | Each organization's report; secondary summaries labeled until read at the source |
| Link to the job market | Field-of-study trends against postings and pay by occupation; degree vs no degree by age (`nc_cps_degree_age.py`); New York Fed outcomes by major | Same pipeline |
| Hypotheses (labeled as such) | The exposure-versus-AI-asks gap by function (high exposure, low AI-skill postings) and what moves it; AI-skill share in finance, HR, legal and administration; within-employer AI pay gap in those functions; solo-founder share; entry-level applications per posting | Our postings (once per edition), AEI, Carta, Handshake |

