# Displacement Report pipeline

Scripts that produce the data behind the **NextChapter Displacement Report**
(`/reports`) and the **White-Collar Displacement Index** (`/reports/white-collar-index`).
All figures come from public sources; no NextChapter customer data is used.

## Secrets (`.env.local`)

```
CENSUS_API_KEY=...        # free: https://api.census.gov/data/key_signup.html
SEC_USER_AGENT=NextChapter Research you@yourdomain.com   # a real contact; SEC requires it
```

Both are loaded via Node's `--env-file=.env.local`, the same way the other
project scripts get their secrets.

## `nc_white_collar_index.py` — the White-Collar Displacement Index

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
