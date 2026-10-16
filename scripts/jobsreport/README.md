# Jobs report pipeline

Spec: `docs/specs/NextChapter_Jobs_Report_Spec.md`. Louisville plan: `docs/jobs-report/`.

- `crawl_louisville.py`: fetches Louisville-metro postings from the adapters listed in `louisville_sources.json` (Workday, Greenhouse, Lever, USAJOBS) and upserts them into `jobsreport_posting` (schema in `prisma/sql/2026-10-15-jobsreport.sql`, already applied to Supabase). Run `--dry-run` first. Needs outbound access to the job sites and, for upsert, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Written without network access and not yet run against live sites; the pure functions (pay, county, arrangement) are checked.
- `louisville_snapshot.sql`: counts over the app's `ExclusiveJobPosting` feed, for interim numbers.

To add an employer: add a line to `louisville_sources.json`. Workday sites are discovered from robots.txt if `site` is omitted.

## Local report for any place

`geos.json` defines places (city, county or state: a location regex, an exclusion regex, county FIPS, and optional peers). `local_report.sql` holds the analysis queries; `local-report.ts` runs them for a place and its peers and writes `out/<place>.json` and `.md`.

    npx tsx --env-file=.env.local scripts/jobsreport/local-report.ts --geo louisville-metro
    npx tsx --env-file=.env.local scripts/jobsreport/local-report.ts --geo kentucky --peers louisville-metro,lexington-ky

Covers: overview and source mix, levels, functions, AI versus non-AI pay and skills, remote/hybrid/on-site, benefits and culture language, W-2 versus contract/1099 language, employer concentration, functions gaining and losing (needs two months of `jobsreport_posting` history), and peer comparison within source type (aggregator versus direct). To add a place, add an entry to `geos.json`.

Status: the SQL was tested against the database through the Supabase tool (levels, AI pay, engagement, skills by AI, source mix). `local-report.ts` has not been run: this environment has no `node_modules`.

`peer_bls.py` pulls unemployment rate, labor force and total nonfarm employment for a place and its peers from the BLS public API, for the latest month all have in common, on one basis (not seasonally adjusted). Metro codes (state FIPS, CBSA) are in `geos.json`. Not yet run: api.bls.gov is blocked in the authoring environment, and the series ID formats should be confirmed on first run.

## Tagging

`classify.sql` tags every `jobsreport_posting` with `level` (ENTRY, MID_IC, SENIOR_IC, MANAGER, DIRECTOR, VP_PLUS), `function`, `occupation_group` and `white_collar` (Census major groups 1 and 2, as in the Employment Report), from the job title, by ordered rules. Run it after each load (it updates every row and stores `tag_rule_version`). Spot-check results by sampling titles in each bucket after changing a rule. Known limits: title-only, so new-graduate roles are not marked ENTRY unless titled so; some healthcare technician titles are judgment calls (the rules follow the Census: radiologic, surgical and pharmacy technologists, EMTs and teaching assistants are professional; medical assistants, nursing assistants and patient care techs are not).

Pay parsing takes the first dollar range in the text, so values over $1,000,000 are nulled after loading (revenue and investment figures); report medians, not means.
