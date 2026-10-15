# BLS state and metro pay: scope and how it works

Goal: the Pivot Tool shows pay for the person's own metro area or state, and compares two roles in the same place, instead of a national figure that can be far off.

## Source

BLS Occupational Employment and Wage Statistics (OEWS), free, public domain. Three files, each saved from Excel as CSV, from https://www.bls.gov/oes/tables.htm:

| File | Rows we use | What each row holds |
|---|---|---|
| National (`national_M20XX_dl`) | one per occupation | employment, 10th/25th/median/75th/90th percentile annual wage |
| State (`state_M20XX_dl`) | one per state per occupation | same |
| Metro (`MSA_M20XX_dl`, metropolitan areas) | one per metro area per occupation | same |

Nonmetropolitan areas and territories are skipped on purpose: a person in a rural area falls back to their state.

## Size

Only occupations already in the taxonomy are kept, so the white-collar scope (a few hundred occupations) keeps this small. Upper bounds by arithmetic, not measured: about 54 states x 250 occupations is roughly 13,500 state rows; roughly 390 metro areas x 250 occupations is under about 100,000 metro rows, fewer after BLS suppresses small cells. The importer's `--dry-run` prints the real counts. No per-view API calls: it is all read from our own tables.

## Load

```
npm run careers:import-bls -- --oews national.csv --oews-state state.csv --oews-metro msa.csv --wage-year 2024 --dry-run
npm run careers:import-bls -- --oews national.csv --oews-state state.csv --oews-metro msa.csv --wage-year 2024
```

Run `prisma/manual/2026-10-15-career-local.sql` first. Re-running replaces each area type as a set, so a newer release fully supersedes the old one. OEWS is published once a year, so this is an annual job.

## How a person gets matched to a place

`src/lib/careers/area.ts`: their state resolves to a state row. Their metro resolves in two steps: our curated big-metro list (`metro-areas.ts`) first, then any metro whose BLS name lists their city and state ("Boston-Cambridge-Nashua, MA-NH" contains Cambridge, MA). Only areas actually loaded are ever returned. No match means the state; no state data means national.

## What the Pivot Tool does with it

- Shows median pay for the narrowest place we have, labelled with the place, plus the middle-half range when BLS publishes it.
- Compares two roles **in the same place**. If the person's metro has pay for their current job but not for the target, it compares at state level instead, never a metro figure against a national one.
- The "how much pay will you give up" filter uses these local comparisons.

## Limits

- **Executive pay is understated.** BLS withholds annual wages at or above its ceiling (about $239,200; `OEWS_WAGE_CEILING`, confirm each year). We show "$239,200 or more" with a note, report the change as "at least", and never drop a role for pay on that basis. A withheld percentile is stored as empty, never invented.
- **Occupation level only**, not seniority, so a VP and a manager in the same occupation share a row.
- OEWS is a three-year survey panel adjusted for inflation, so it lags the market.
- **Projections stay national.** State and metro growth outlooks come from state labor-market-information offices (Projections Central), not BLS OEWS. Not built; it would be per-state files like the training lists.
- The first metro load decides how many metros resolve by name. Cities inside a metro that BLS names after other principal cities may not match; they fall back to the state.
- Importers have only run on fixtures.
