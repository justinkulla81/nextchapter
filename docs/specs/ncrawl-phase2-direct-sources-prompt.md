Goal: make the ncrawl crawler read ten employers' own Workday career boards, so their US jobs come in as direct listings (`directListing` true, `sourceCategory` 'employer') instead of through Jooble. Work in this repo (`nextchapter-jobs`). Dry-run first; do NOT import into production until the owner approves the numbers.

Context
- NextChapter's board (repo justinkulla81/nextchapter, Postgres table "ExclusiveJobPosting", fed by the import endpoint `/api/admin/jobs/import`) holds about 74,000 live US jobs whose apply link is jooble.org. Google is now offered only direct employer-system jobs, so Jooble-linked jobs are not indexed. We want the employers' own listings instead.
- Rule: use the employer's career site and job system, never its corporate site. Only public Workday endpoints; identify as NextChapter (user agent `NextChapterResearch/1.0 (research@launchyournextchapter.com)`).
- US jobs only. Keep the existing US screen (the board is US-only); do not bring in other countries.
- Jobs reports cover all white-collar jobs at every level, entry-level included. The import screen currently keeps only manager-and-up and senior individual roles plus a rank floor and posted-date window. Do not change those rules in this task; report how many US white-collar jobs from these ten boards they drop, by level, so the owner can decide.

The ten boards (public Workday `POST https://<tenant>.<wd>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs`, verified 2026-11-05; "total" is all countries, capped at 2,000 by Workday)
| Employer | tenant | cluster | site | live via Jooble | live direct now |
| Accenture | accenture | wd103 | AccentureCareers | 217 | 0 |
| Nvidia | nvidia | wd5 | NVIDIAExternalCareerSite | 170 | 0 |
| Salesforce | salesforce | wd12 | External_Career_Site | 138 | 6 |
| Abbott | abbott | wd5 | abbottcareers | 113 | 0 |
| Citigroup | citi | wd5 | 2 | 107 | 1 |
| State Street | statestreet | wd1 | Global | 99 | 0 |
| Booz Allen Hamilton | bah | wd1 | BAH_Jobs | 129 | 122 |
| Raytheon (RTX) | globalhr | wd5 | REC_RTX_Ext_Gateway | 231 | 29 |
| Jones Lang LaSalle | jll | wd1 | jllcareers | 87 | 3 |
| Leidos | leidos | wd5 | External | 101 | 251 |
These are also in the nextchapter repo at `scripts/jobsreport/sources/jooble-top.json` and `docs/jobs-report/jooble-to-direct-phase2.md`.

Do this
1. Find how ncrawl defines a Workday source (adapter, config file, how `direct_listing` and `sourceCategory` get set). Say which files. Add the ten boards the same way as existing Workday employers. Note Workday's 2,000 cap: a board with more than 2,000 results needs facet filters (for example by country or location) or several queries so the crawl is not truncated. Say how you handled it.
2. Dry-run the crawl for these ten only (no upload). For each employer report the funnel: listed on the board, fetched, non-US dropped, dropped by the seniority/title screen (by level: entry, early IC, mid, senior IC, manager and up), dropped by the rank floor, dropped by the posted-date window, duplicates, kept. List 10 example titles dropped at entry or early level per employer.
3. Compare kept US jobs per employer with the "live direct now" and "live via Jooble" columns above, and with the board's own US count.
4. Dedupe plan: for a requisition that arrives both direct and through Jooble, the direct row should win. Show how ncrawl would match them (employer, normalized title, location, requisition id) and whether the import keeps the Jooble row or archives it. Do not change anything yet.
5. Check the liveness path: direct rows need `lastVerifiedAt` kept fresh by the crawl (the site shows a job only if verified within 14 days). Confirm the new sources are in the liveness re-check.

Report back
A table of the funnel per employer, the files you changed or would change, the dedupe plan, and a recommendation. Mark anything you could not measure. Do not run the import against production, and do not guess numbers.
