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

## Results of the full runs (2026-11-13)

**Workable (engine 1), complete:** 71,798 US jobs from 3,002 employers (`workable-us-employers-2026-11-13.csv`). 96% have a description of 1,500+ characters. About 14% have hourly or trades titles. Top states: CA 10,135, TX 7,672, NY 5,628, NJ 3,817, FL 3,693.
The employer count is concentrated: Kreyco 4,652, Mindrift 2,151, "Clients Blackbox, Inc." 1,887, NoGigiddy 1,698, WealthBridge Financial Group 1,432. Several of these look like gig platforms,
recruiters or mass postings. Apply the ghost-listing screen (`ghost-risk.ts`) and cap per-employer counts before import.

**Workday discovery from 10,405 SEC company names (engine 2), complete:** 704 Workday tenants, 1,296 career sites, 345,499 jobs (all countries; each site's total is capped at 2,000 by Workday's count).
By how well the tenant matches the company name: strong (tenant equals the full name) 756 sites, 207,676 jobs; medium (first two words) 324 sites, 87,358; weak (first word or initials) 216 sites, 50,465.
Verify the company on weak and medium matches before import. 107 more tenants were found whose career site name is not guessable (`workday-sec.json` has the rest). Largest: CVS Health 19,320, Dollar Tree 18,689, TJX 10,824, DaVita 3,360, Thermo Fisher 3,265, Micron 2,902.
Overlap: CVS, TJX, Dollar Tree and others are also on Phenom (below); count each employer once.

**Phenom (engine 2b):** 56 of the 74 Phenom career hosts answer the public `/widgets` search: 94,390 jobs (all countries), `sources/phenom-found.json`.

**Career hosts for 10,405 SEC names (`career_hosts_fast.py`):** 1,240 career hosts (careers.<name>.com or jobs.<name>.com) and the system behind each: SuccessFactors 202, Workday 150+, Phenom 111, Radancy 62, iCIMS 73, Jibe, Eightfold 30, Oracle 33, Avature 11, Greenhouse 16 (`sources/career-hosts-sec.json`).
Their sitemaps list about 358,000 job-like URLs across the 441 non-Workday hosts (`career-hosts-sitemap-counts.json`; noisy: some hosts matched the wrong company, and some URLs are category pages). Use the JobPosting JSON-LD (engine 4) on them.

**Greenhouse, Lever and Ashby by name on the same 10,405 (engine 3):** 363 verified-by-address boards (265 Greenhouse, 51 Lever, 47 Ashby), 23,091 jobs (`sources/sec-gh.json`).

**Order of magnitude:** Workable 71.8k US + Workday strong matches about 207k all-country (about 125k US at 60%) + Phenom 94k (overlapping Workday) + Greenhouse/Lever/Ashby 23k + the sitemap hosts, before the seniority screen and de-duplication against production.

## Workday on private companies, universities, hospitals and nonprofits (2026-11-13)

`workday_discover.py` run on name lists from public sources: 6,256 US colleges and universities (Urban Institute IPEDS directory), 5,301 hospitals (CMS hospital file), the 16,000 largest tax-exempt
organizations by revenue (IRS exempt-organization file, $10M and up; 8,000 + 8,000 names) and the 1,201 largest non-staffing employers on our board with Jooble or Careerjet copies.
Result files, each one source per Workday tenant and career site, with `nameMatch` (strong: tenant equals the full name; medium: first two words; weak: first word or initials):

| List | Names | Tenants | Sites | Jobs (all countries) |
|---|---|---|---|---|
| Largest employers on our board with only Jooble copies | 1,201 | 166 | 326 | 96,588 |
| Universities | 6,256 | 293 | 507 | 83,675 |
| Hospitals | 5,301 | 231 | 386 | 103,415 |
| Nonprofits, largest 8,000 | 8,000 | 455 | 797 | 169,610 |
| Nonprofits, next 8,000 | 8,000 | 280 | 542 | 102,912 |
| SEC companies (earlier) | 10,405 | 704 | 1,296 | 345,499 |

Combined and de-duplicated by tenant and site (`sources/workday-all-unique.json`): **1,278 tenants, 2,313 career sites, 533,670 jobs** (all countries; Workday caps each site's count at 2,000, so large boards are undercounted).
Strong matches 278,798 jobs, medium 141,080, weak 113,792. Many health systems appear under several facility names (Trinity Health, Sentara, Sanford, Mercy) and map to one tenant; the unique file counts each once.
Weak and medium matches need the company name checked from the postings before import: a short tenant word (for example `trinity`, `mercy`) can belong to a different employer. Some sites repeat the same jobs under two site names.

## The Company table (2026-11-13)
The cloud session cannot read `Company` in bulk (no database connection; the anon key returns nothing under row-level security), so I took the 2,381 size-classified rows (MID_LARGE, LARGE, ENTERPRISE, MEGA) through the
database connector in one bounded read and ran 587 names not already covered by the SEC, university, hospital, nonprofit and Jooble lists: 149 tenants, 278 sites, 63,362 jobs, of which only 19 tenants and about 5,100 jobs were new
(`sources/workday-company-sized.json`). Everything already searched overlaps heavily, so the size-classified part of `Company` is now covered: **1,297 tenants, 2,352 career sites, 538,834 jobs** in `workday-all-unique.json`.
The other ~100,000 names are mostly small local employers (law firms, clinics, churches), where Workday is rare. To run them anyway on a machine with database access:
`DATABASE_URL=... bash scripts/jobsreport/company_table_workday.sh` (one read of about 5 MB, then about 8 hours at 100 threads).

## Round two: iCIMS, SmartRecruiters, BambooHR, Recruitee, Breezy, Oracle HCM, more Phenom (2026-11-13)
Run on the 36,341 distinct names from the SEC, university, hospital, nonprofit, Jooble-top and size-classified Company lists. New scripts: `icims_discover.py`, `smb_ats_discover.py`.

| System | Found | Jobs | File |
|---|---|---|---|
| iCIMS (careers-/jobs-<name>.icims.com; "Page 1 of N" times rows) | 491 portals | about 63,500 estimated | `sources/icims-found.json` |
| SmartRecruiters (api.smartrecruiters.com companies, totalFound) | 383 boards | 67,743 | `sources/smb-ats-found.json` |
| BambooHR (`/careers/list`) | 694 boards | 4,283 | same |
| Recruitee (`/api/offers/`) | 111 boards | 7,215 | same |
| Breezy (`/json`) | 91 boards | 1,699 | same |
| Oracle HCM (recruitingCEJobRequisitions on the career hosts already found) | 23 sites | 135,699 | `sources/eightfold-oracle-found.json` |
| Phenom, 59 more career hosts (`/widgets`) | +46 hosts | +47,203 (now 102 hosts, 141,593) | `sources/phenom-found.json` |
| Eightfold | 3 tenants | 1,157 | `sources/eightfold-oracle-found.json` |

About 327,000 jobs (all countries) before overlap with Workday, the US-only filter, the seniority screen and the white-collar rule. A large share is store and hourly work: Dollar General 91,429 (Oracle), Domino's 24,995 (SmartRecruiters), Advance Auto Parts 16,333 (Phenom), Marriott 13,156 (Oracle), Albertsons 8,739 (Oracle).
Name-match strength is on every source (`nameMatch`); SmartRecruiters and iCIMS names can belong to another employer (for example "St Georges School" with 4,611 SmartRecruiters jobs), so verify the company from the postings before import.
Weak matches are 11,137 SmartRecruiters/BambooHR/Recruitee/Breezy jobs and 22,025 iCIMS jobs.

## Round three: government and education boards, measured sitemap hosts (2026-11-13)

**Government (governmentjobs.com, NEOGOV).** `https://www.governmentjobs.com/sitemap.xml` lists 40,466 job pages. A random sample of 400: 95% carry schema.org JobPosting data, all US, 94% have a description of 1,500+ characters, the hiring agency is named
(San Bernardino County, City of Henderson, State of Louisiana, City and County of Honolulu), about 30% are hourly, trades or public-safety titles. We hold 5,758 live rows from this host, so about 34,700 are new.
**Education (EDJOIN, California K-12 and colleges).** `https://www.edjoin.org/sitemap/jobs/1` lists 14,798 job pages; sample of 400: all carry JobPosting data, all US (98% California), 63% with 1,500+ characters, about 36% support or hourly titles. We hold 835 live rows; about 14,000 new.
Both are the employers' own posting systems. `scripts/jobsreport/sitemap_jsonld_harvest.py` reads any sitemap's job pages into JSON lines (resumable, 8 to 10 threads).

**Measured sitemap hosts.** The 441 career hosts with sitemaps (`career-hosts-sitemap-counts.json`) were sampled: 10 pages per host checked for JobPosting data (`sitemap-hosts-measured.json`). 231 unique hosts, 148,629 job pages, about 92,300 of them US. Largest: Marriott (Oracle) 28,551, Home Depot (BrassRing) 25,509,
Nike (Avature) 17,567, Ulta (iCIMS) 11,868, Northrop Grumman (Eightfold) 3,179. By system, not yet counted anywhere else: BrassRing 25,509, Avature 23,770 (13,012 US), Eightfold 13,040, Radancy 10,634, SuccessFactors 3,504, Taleo 720, about 77,000 in all (about 55,000 US). Oracle and iCIMS hosts overlap earlier counts.
Two hosts matched the wrong company (a SPAC shell named General Catalyst) and were dropped.

**Checked and not used:** Microsoft's careers search API (blocked from the cloud network), Accenture and Apple (not reachable), USAJOBS (needs an API key), `jobs.lever.co`, `jobs.smartrecruiters.com`, `ats.rippling.com`, `jobs.dayforcehcm.com`, Paylocity and Paycom (no global sitemap).
