# Going direct for the top Jooble employers (Phase 2, started 2026-11-05)

Goal: for the employers we get most jobs for through Jooble, read the employer's own career system instead, so the jobs are direct and can be offered to Google (Phase 1, #1027, offers only direct jobs). Method: career site and job system, never the corporate site (CLAUDE.md "Employer discovery rule"). Counts are live US jobs verified in the last 14 days, 2026-11-05.

## Result so far

Ten employers have a readable public Workday board. A Workday board answers at `https://<tenant>.<wd>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs`; "total" is what it reported (Workday caps the figure at 2,000, so a board showing 2000 has at least that many, all countries).

| Employer | Live via Jooble | Live direct now | Workday board (tenant, cluster, site) | Board total |
|---|---|---|---|---|
| Accenture | 217 | 0 | accenture, wd103, AccentureCareers | 2000+ |
| Nvidia | 170 | 0 | nvidia, wd5, NVIDIAExternalCareerSite | 2000+ |
| Salesforce | 138 | 6 | salesforce, wd12, External_Career_Site | 1558 |
| Abbott | 113 | 0 | abbott, wd5, abbottcareers | 2000+ |
| Citigroup | 107 | 1 | citi, wd5, 2 | 2000+ |
| State Street | 99 | 0 | statestreet, wd1, Global | 1192 |
| Booz Allen Hamilton | 129 | 122 | bah, wd1, BAH_Jobs | 2000+ |
| Raytheon (RTX) | 231 | 29 | globalhr, wd5, REC_RTX_Ext_Gateway | 4689 |
| Jones Lang LaSalle | 87 | 3 | jll, wd1, jllcareers | 2000+ |
| Leidos | 101 | 251 | leidos, wd5, External | 2000+ |

Each board lists far more than we hold direct (Nvidia: 0 direct, 2,000+ on its board). The sources are in `scripts/jobsreport/sources/jooble-top.json` in this repo's crawler format. The production crawler is `nextchapter-jobs` (ncrawl), which is not reachable from the cloud session: these entries have to be added there.

## Not found yet (career site or system not confirmed)

AECOM, Stantec, Deloitte, Lockheed Martin, Google, Apple, PwC, KPMG, Walmart: either a custom system (not Workday) or a Workday site name not guessed. (Goldman Sachs, Jacobs, ADP and TikTok are resolved below.) Lockheed, Deloitte, Google, Apple, PwC, KPMG, Walmart, AECOM and Stantec already have direct rows, so their crawler source exists; the Jooble remainder is a coverage gap to look at in ncrawl (see `ncrawl-google-gap-prompt.md`). The rest need the job system found by following the Apply links on their career page.

## Found on their own sites (2026-11-06)

Goldman Sachs, TikTok and ADP do not use Workday; each runs its own career site with a public endpoint. Jacobs uses Avature behind a bot check. Counts are all countries unless noted. Live via Jooble and direct counts are from 2026-11-05.

| Employer | Live via Jooble | Live direct | Job system | Public endpoint | Status |
|---|---|---|---|---|---|
| Goldman Sachs | 65 | 0 | Own site, higher.gs.com | GraphQL `POST https://api-higher.gs.com/gateway/api/v1/graphql`, operation `GetRoles` (`roleSearch(searchQueryInput)`: `page`, `sort`, `filters`, `experiences`, `searchTerm`; returns `totalCount`, `items { roleId jobTitle locations { city state country } }`) | Works: 698 roles. The US location filter shape is not yet confirmed (a guessed filter field was rejected); filter by `locations.country` client-side until it is. |
| TikTok | 73 | 0 | Own site, lifeattiktok.com | `POST https://api.lifeattiktok.com/api/v1/public/supplier/search/job/posts` with headers `Origin: https://lifeattiktok.com`, `Referer: https://lifeattiktok.com/`, `website-path: tiktok`; body `{"keyword":"","limit":100,"offset":0,"job_category_id_list":[],"location_code_list":[],"subject_id_list":[],"recruitment_id_list":[],"portal_type":6,"job_function_id_list":[],"storefront_id_list":[],"portal_entrance":1}` | Works: 4,291 postings, about a third in the US (38 of the first 100; one page, an estimate). Each post has `city_info` with the country. Page with `offset`. |
| ADP | 151 (two company names) | 0 | Own server-rendered site, jobs.adp.com | Listing `https://jobs.adp.com/en/jobs/?page=N` (about 47 pages), detail `https://jobs.adp.com/en/jobs/<id>/<slug>/` with JobPosting data (address in `addressRegion`; no `validThrough` seen). Apply goes through myjobs.adp.com | Readable by page crawl. |
| Jacobs | 81 | 0 | Avature, careers.jacobs.com (`/en_US/careers/SearchJobs`) | None readable | Blocked: every request, including robots.txt and the sitemap, answers an empty HTTP 202 (a bot challenge). Unresolved; the jobs stay on Jooble for now. |

These need their own crawler adapters (not a Workday config line). Goldman and TikTok are clean JSON; ADP is a page crawl. Prompt: `docs/specs/ncrawl-own-site-adapters-prompt.md`.

## Next tier: 23 more Workday boards (2026-11-07)

Employers ranked just below the first ten by live Jooble jobs, not staffing firms. Each board answered the public Workday jobs endpoint on 2026-11-07 (all countries; Workday caps its count at 2,000). Together they hold 1040 Jooble-linked live US jobs. Sources, in crawler format: `scripts/jobsreport/sources/jooble-next.json`. Prompt: `docs/specs/ncrawl-next-tier-prompt.md`.

| Employer | Live via Jooble | Live direct now | Workday board (tenant, cluster, site) |
|---|---|---|---|
| Hitachi | 59 | 0 | hitachi, wd1, hitachi |
| Johnson Controls | 58 | 0 | jci, wd5, JCI |
| KBR | 57 | 7 | kbr, wd5, KBR_Careers |
| Micron | 55 | 4 | micron, wd1, External |
| Capital One | 55 | 286 | capitalone, wd12, Capital_One |
| Boeing | 54 | 4 | boeing, wd1, EXTERNAL_CAREERS |
| Guidehouse | 53 | 86 | guidehouse, wd1, External |
| Morgan Stanley | 50 | 1 | ms, wd5, External |
| Home Depot | 49 | 3 | homedepot, wd5, CareerDepot |
| RSM | 46 | 0 | rsm, wd1, RSMCareers |
| Palo Alto Networks | 44 | 118 | paloaltonetworks, wd5, panwexternalcareers |
| Stryker | 43 | 85 | stryker, wd1, StrykerCareers |
| Centene | 42 | 8 | centene, wd5, centene_external |
| Verizon | 42 | 0 | verizon, wd12, verizon-careers |
| General Motors | 41 | 0 | generalmotors, wd5, Careers_GM |
| The Hartford | 41 | 0 | thehartford, wd5, Careers_External |
| Wolters Kluwer | 38 | 0 | wk, wd3, External |
| Merck | 37 | 4 | msd, wd5, SearchJobs |
| Truist | 37 | 0 | truist, wd1, Careers |
| AIG | 36 | 0 | aig, wd1, aig |
| Flextronics (Flex) | 35 | 0 | flextronics, wd1, Careers |
| Gartner | 34 | 18 | gartner, wd5, EXT |
| M&T Bank | 34 | 0 | mtb, wd5, MTB |

**Other systems found, not yet verified** (the crawler needs an adapter for each): Uber (Oracle HCM, jobs.uber.com), Ford (Radancy, careers.ford.com), AMD (iCIMS and Jibe, careers.amd.com), Honeywell and BMO (Phenom), New York Life and Leonardo DRS (SAP SuccessFactors), Takeda (Avature).

**No career system found by the probe:** EY, Willis Towers Watson, Visa, Regeneron, BD, HII, Schneider Electric, SAIC, USAA, Atlassian, Intuitive Surgical, Fujifilm, Canon, Anduril, WSP, Turner & Townsend, HNTB, BDO (a Workday site name not guessed, or a custom system). EY and Anduril, Capital One, Oracle and some others already have direct rows from another source.

## Tier 3: 25 more Workday boards (2026-11-09)

Found for the plan to raise live direct jobs by 25% (crawler fixes and new sources only; the 14-day window stays as it is). Real employers ranked below the first 33 by live Jooble rows, not staffing firms. Each board answered the public Workday jobs endpoint on 2026-11-09. Together they hold 705 Jooble-linked live US jobs and list 45,081 jobs on their boards (all countries; Workday caps its count at 2,000, so four boards hold more). Sources, in crawler format: `scripts/jobsreport/sources/jooble-tier3.json`. Prompt: `docs/specs/ncrawl-tier3-prompt.md`.

Expected yield: on the first 33 employers about 35% of listed jobs were kept after the US and level screens (10% to 63% by employer). At 35% these 25 would add roughly 9,000 to 13,000 live direct jobs (about +4% to +5%), CVS Health's retail-heavy board counted at a lower rate. An estimate, not a measurement.

| Employer | Live via Jooble | Workday board (tenant, cluster, site) | Board total |
|---|---|---|---|
| CVS Health | 102 | cvshealth, wd1, CVS_Health_Careers | 18970 |
| U.S. Bank | 53 | usbank, wd1, US_Bank_Careers | 1222 |
| Regeneron | 50 | regeneron, wd1, Careers | 626 |
| Cisco | 37 | cisco, wd5, Cisco_Careers | 1464 |
| Blue Origin | 32 | blueorigin, wd5, BlueOrigin | 1887 |
| GE Appliances | 31 | haier, wd3, GE_Appliances | 163 |
| T-Mobile | 28 | tmobile, wd1, External | 2000 |
| Marsh McLennan | 28 | mmc, wd1, MMC | 1972 |
| Advocate Health | 26 | aah, wd115, External | 2000 |
| IQVIA | 26 | iqvia, wd1, IQVIA | 1899 |
| Sedgwick | 25 | sedgwick, wd1, Sedgwick | 621 |
| Comcast | 24 | comcast, wd115, Comcast_Careers | 681 |
| Cushman & Wakefield | 23 | cw, wd1, External | 2000 |
| TransUnion | 20 | transunion, wd5, TransUnion | 222 |
| EisnerAmper | 19 | eisneramper, wd1, EisnerAmper_External | 157 |
| Equinix | 19 | equinix, wd1, External | 309 |
| Philips | 18 | philips, wd3, jobs-and-careers | 800 |
| John Hancock | 18 | manulife, wd3, MFCJH_Jobs | 606 |
| Magna | 18 | magna, wd3, Magna | 1383 |
| Thomson Reuters | 17 | thomsonreuters, wd5, External_Career_Site | 488 |
| Curtiss-Wright | 16 | curtisswright, wd1, CW_External_Career_Site | 387 |
| GE Vernova | 16 | gevernova, wd5, Vernova_ExternalSite | 2156 |
| 3M | 16 | 3m, wd1, Search | 786 |
| Bristol-Myers Squibb | 15 | bristolmyerssquibb, wd5, BMS | 628 |
| Novartis | 15 | novartis, wd3, Novartis_Careers | 860 |
| RELX | 13 | relx, wd3, relx | 794 |

**Other job systems found, needing a crawler adapter** (public career pages found by the career-site probe; endpoints not yet verified): Phenom (Marsh, Honda, Honeywell, LPL Financial, GE Healthcare, GE Aerospace, Corning, ICF, Philips, Crowe, BMO), Eightfold (Lumen, Qualcomm, Worley), SAP SuccessFactors (New York Life, Capgemini, Daiichi Sankyo, Wipro), iCIMS (Beth Israel Lahey Health, Akima), Oracle HCM (Uber), Avature (Takeda), UKG (Milliman), SmartRecruiters (Eurofins), Jibe (AXA XL). Phenom alone covers about a dozen employers and appears on boards of employers already above, so a Phenom adapter is the best next one to build if the crawler has none.

**Not readable by the probe:** AMN Healthcare, Genworth, Amentum, CBRE, Zurich, Compass Group, Jazz Pharmaceuticals, Sodexo, Amcor, General Dynamics, Eli Lilly, Kroll, Koch, Fisher Investments, Neurocrine, Cohesity, Estee Lauder, Tempus, Globe Life, AdventHealth, Stellantis, Caris, Paylocity, Vizient, Protiviti, Grant Thornton, Moss Adams, Baker Tilly, FTI Consulting, Genentech, Visa, SAIC, Corning (a Workday site name not guessed, or a custom system).

## Staffing and recruiter firms (do not chase)

Robert Half (866 via Jooble), CyberCoders (365), Jobot (343), LHH (327), Insight Global, Apex Systems, Kforce, Mindlance, HAN Staffing, Addison Group, Acturhire, Green Key, Artech, Motion Recruitment, Vaco, Randstad, Experis, Ampcus and similar. The posting is the recruiter's own listing for an unnamed client; the apply link is not a copy of a client's career-site job. Decision for the owner: keep them out of search (current rule) or index the ones whose own career site posts the job.

## "Confidential" (1,002 jobs)

Not an employer. Each is a recruiter's listing with the client hidden. Cannot be made direct.

## Next steps

1. In ncrawl, add the ten boards above as `direct_ats` Workday sources, run, import, and compare direct counts per employer with the table.
2. For each employer, archive or demote its Jooble rows once the direct row for the same requisition exists (dedupe on employer, normalized title, location).
3. Find the systems for the not-found list; continue down the Jooble list by volume.
4. Track the Jooble share of live jobs and the direct count for these ten weekly (the admin Job source chart, `JobSourceShareChart`, already splits Direct and Jooble).
