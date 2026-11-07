# Data and code for the October 2026 White Collar Employment Report

Version 1.2. Aggregate cells only; no microdata. Not seasonally adjusted unless noted.

| File | What it is |
|---|---|
| `cps-long-search-by-group-jan-sep.csv` | Exhibit 1 and 3: unemployment rate, share of unemployed out 27+ weeks, median spell so far, counts and 90% margins, by group, Jan-Sep 2026 vs 2025 |
| `validation-vs-bls-jan-sep.csv` | Our CPS pipeline vs BLS-published all-worker figures for the same months |
| `long-search-index-monthly.csv` | White-Collar Long-Search Index inputs and the 3-month index (2019 = 100), months available |
| `scorecard-industry-age-jan-sep.csv` | Exhibit 4: white-collar and all-worker unemployment rate, share out 27+ weeks and change with 90% margin, by industry of last job and age |
| `ai-skill-pay-2026-11-07.csv` | Exhibit 10: posted-pay medians for postings naming AI skills and other postings, all 89 function-and-level cells with 30+ postings of each kind |
| `employer-rankings-2026-10-26.json` | Employer rankings (open jobs, entry-level, AI-skill asks) by function, Oct 26, 2026 |
| `../aei-no-aggregator/` | Anthropic Economic Index match exhibits (postings excluding aggregator-linked ones) |
| `../methodology-note-margins-of-error.md` | How the margins of error are computed, with a worked example |

Code (repository `scripts/employment-report/`): `nc_cps_breakdowns.py` (CPS groups), `gvf-long-search-margins.py` (BLS-method margins), `make-long-search-chart.py` (Exhibit 1), `nc_white_collar_index.py` (index), `build-report-html.py` and `nc_build_pdf.js` (page and PDF).

Definitions. White-collar: Census major occupation groups 1 and 2 (PRMJOCC1 = 1 or 2), current or most recent job. Knowledge workers: white-collar occupation and a bachelor's degree or more (PEEDUCA >= 43). Long-term unemployed: unemployed 27 weeks or more (PRUNEDUR >= 27), a spell in progress. Weights: PWCMPWGT.

Suggested citation: NextChapter, White Collar Employment Report, October 2026, version 1.2, November 2026. launchyournextchapter.com/reports

Revision log: 1.2 (Nov 7, 2026): added a chapter comparing white-collar and all workers by industry and age (Exhibit 4), an AI and the workforce chapter (company statements, posted pay for postings that name AI skills, training programs, hiring rules) and a job-search chapter (applications, interviews, referrals); no earlier figure changed. 1.1 (Nov 7, 2026): added a watch note on data center moratoriums and interest-rate-sensitive sectors to the Clouds chapter; no figures changed. 1.0 (Nov 6, 2026): initial release. Corrections will be listed here with the date and the figure changed.
