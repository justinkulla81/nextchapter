# Getting 100,000 more direct jobs: the engines (2026-11-13)

Rule: read the job systems and the platforms that aggregate them, never the employers' corporate websites. Public endpoints only, identified user agent, polite rate.

## Engine 1: Workable's public job board (largest, ready now)
`https://jobs.workable.com/api/v1/jobs` lists the jobs employers post in their own Workable accounts, across every employer, with the company, location, posted date and
full description. `location=United States` returns 71,785 jobs (171,411 worldwide). We hold 1,145 live Workable rows today. Page size is capped at 20, so about 3,600 requests, roughly an hour at one request every 0.4 s.
`scripts/jobsreport/workable_board.py` harvests it (resumable, one line of JSON per job). First 1,940 jobs: 497 employers, 98% with a description of 1,500+ characters (indexable),
all US, 69% full-time, about 15% hourly or trades titles. Extrapolated: about 12,000 employers.

## Engine 2: Workday, Phenom, Oracle, IBM and other enterprise boards (already found)
25 sources with board totals summing to 60,418 jobs (all countries): CVS Health 19,086, Lowe's 12,993, TJX 10,051, IBM 3,125, Target and Citigroup 2,000 each (capped), J&J 1,795, Morgan Stanley 1,191,
Home Depot 941, P&G 886, Boeing 821, Comcast 709 and others (`sources/jooble-tier5.json`, `jooble-tier6.json`, `jooble-tier6b.json`, `stocks-*.json`).
Workday sites are found by guessing the tenant and site (a real tenant answers 404 for a wrong site, 422 otherwise).

## Engine 3: platform boards found by name (Greenhouse, Lever, Ashby)
Each employer on those platforms has its own public board; no platform-wide list exists. `scripts/jobsreport/unicorn_probe.py` tries the full employer name as the board address and verifies the
board's own name. Run on the 105,000 names in `Company` (start with the 40,000 Jooble employers, most rows first); the August pilot found a verified board for about 11% of long-tail employers.

## Engine 4: JobPosting structured data on any career host
`scripts/jobsreport/jsonld_probe.py` reads a career host's sitemap and the schema.org JobPosting data Google for Jobs requires. Works where no adapter exists.

## Checked and not used
- Resolving jobviewtrack.com and jooble.org links to find the employer's system: the first hop is a Careerjet affiliate click redirect (clicks would be registered) and Jooble answers 403. Not done.
- Common Crawl's index (to list every board address on each platform): reachable but answering 504 or empty from the cloud network today; run it from the Mac, one platform and one letter prefix at a time.
- Third-party scraped datasets of board lists: licensed for non-commercial use; not used.
- Remote-only boards (Remotive, Arbeitnow, RemoteOK, WeWorkRemotely) are aggregators of postings; not direct.
