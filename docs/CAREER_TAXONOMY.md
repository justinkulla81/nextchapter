# Career taxonomy and the Pivot Tool

Public occupation data behind `/dashboard/pivot` ("Explore other roles") and the grounded skill-gap suggestions. We adopt government data rather than maintain our own taxonomy.

## Sources

| Data | Source | Licence |
|---|---|---|
| Occupations, skills, knowledge, tools, alternate titles, job zones, related occupations | [O*NET database](https://www.onetcenter.org/database.html), US Department of Labor | CC BY 4.0, attribution required |
| Median pay and employment | [BLS OEWS national estimates](https://www.bls.gov/oes/tables.htm) | Public domain |
| Growth and annual openings | [BLS Employment Projections, table 1.2](https://www.bls.gov/emp/tables.htm) | Public domain |
| Local openings (optional) | Adzuna, through the existing `adzuna-insights` cache | Gated by `ADZUNA_INSIGHTS_ENABLED`; needs their attribution |

O*NET asks for attribution. The Pivot Tool page names O*NET and the Department of Labor in its intro. Add the full O*NET credit line wherever the data is published beyond the dashboard.

## Setup

1. Create the tables (run before deploying the code that reads them):
   `prisma/manual/2026-10-14-career-taxonomy.sql`, or `npx prisma db push` per `docs/DATABASE_SCHEMA.md`.
2. Download the O*NET "text format" database, unzip it, and run
   `npm run careers:import-onet -- --dir <folder> --version 30.0` (add `--dry-run` first to see counts).
3. Download the OEWS national file and Projections table 1.2 from BLS, save each as CSV (BLS ships Excel), and run
   `npm run careers:import-bls -- --oews <file> --wage-year 2024 --projections <file>`.

Both importers are re-runnable. Until step 2 is done, the Pivot Tool shows "Occupation data isn't loaded yet" and skill-gap suggestions behave as before.

## How it works

- `src/lib/careers/vectors.ts`: similarity between occupations. Each occupation is a vector of O*NET skill and knowledge ratings (importance x level). Vectors are centred on the mean across all occupations first, otherwise everything scores about 0.9 against everything. "Skills in common" is a separate measure: how much of what the target asks for the current occupation already covers.
- `src/lib/careers/pivots.ts`: ranks adjacent occupations by skill similarity only. It drops occupations more than one Job Zone below the current one, and ones below the pay floor the person chose (unknown pay is shown as unknown, never treated as a pay cut). Pay, growth and local demand are displayed beside each option, not blended into one score.
- `src/lib/careers/title-match.ts` and `candidate-occupation.ts`: maps a job title to an occupation with no AI. Exact and clear fuzzy matches are saved; anything ambiguous is put to the candidate as a short list. Function-based fallback reuses `src/lib/market/soc-codes.ts`.
- `src/lib/careers/grounding.ts` and `src/lib/skills/skill-gap-suggestions.ts`: the target occupation's tools and knowledge gaps are added to the skill-gap prompt, and used as the fallback list if the model call fails.

## Cost and caveats

- The Pivot Tool makes no model calls. The only metered change is in skill-gap suggestions: a candidate's cached suggestions regenerate once, the first time they are viewed after the taxonomy is loaded (the cache key now includes their current and target occupation). Candidates without a loaded taxonomy are unaffected.
- "Skills in common" and the gaps describe occupations in general (typical O*NET levels), not a test of the person. The UI says so.
- O*NET skill names ("Critical Thinking") are generic; only tools and knowledge areas are offered as skills to add to a plan.
- BLS top-codes wages at $239,200 and suppresses small cells; those are stored as unknown. Executives' pay will often show "not published".
- The importers were written against the documented O*NET and BLS file layouts and tested on small fixtures (`src/test/career-taxonomy.test.ts`). They have not yet been run against the full downloads. Run `--dry-run` first and check the counts (about 900 occupations).
- The taxonomy is held in memory for an hour per server instance.
