# Jobs report pipeline

Spec: `docs/specs/NextChapter_Jobs_Report_Spec.md`. Louisville plan: `docs/jobs-report/`.

- `crawl_louisville.py`: fetches Louisville-metro postings from the adapters listed in `louisville_sources.json` (Workday, Greenhouse, Lever, USAJOBS) and upserts them into `jobsreport_posting` (schema in `prisma/sql/2026-10-15-jobsreport.sql`, already applied to Supabase). Run `--dry-run` first. Needs outbound access to the job sites and, for upsert, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Written without network access and not yet run against live sites; the pure functions (pay, county, arrangement) are checked.
- `louisville_snapshot.sql`: counts over the app's `ExclusiveJobPosting` feed, for interim numbers.

To add an employer: add a line to `louisville_sources.json`. Workday sites are discovered from robots.txt if `site` is omitted.
