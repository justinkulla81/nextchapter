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
