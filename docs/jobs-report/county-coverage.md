# County placement and coverage

Every local report (county, metro, college or workforce-board geography) now reads postings by county.

## Data
- `CompanyJobOpening.countyFips` (+ `countyAmbiguous`): county of the posting's location, from the Census place-to-county crosswalk. SQL: `prisma/manual/2026-10-22-geo-county.sql` (applied to production 2026-10-22). A trigger places new postings; failures leave the column null and never block an import.
- Lookup tables: `GeoCounty` (3,230), `GeoPlaceCounty` (about 33,800), `GeoCountyAdjacent` (about 19,000 pairs from the Census adjacency file), `GeoLocationCounty` (cache of distinct location strings).
- Placement rate on 2026-10-22: about 60% of open postings (307,000 of 513,000). The rest have no city and state we can read ("Remote", "United States", several locations in one string, bare city names). About 16% of open postings sit in places that span counties.
- Counting rule: a posting counts in an area if its preferred county OR any candidate county of its place is in the area.

## Geography ladder for a locality
1. **County** is always shown.
2. **County plus next-door counties** (Census adjacency, including counties in other states) is the headline when the county has fewer than 1,000 open postings. Both columns are always shown side by side; the frames are never blended into one number.
3. If the area is still under the minimum, the report says so and may add the metro (CBSA). State is context only.
Examples: Washington County, PA has 165 postings alone and 2,644 with Allegheny, Westmoreland and its other neighbors; Jefferson County, KY has 2,134 alone.

## Coverage (the "partial index" line)
Expected open jobs = private-sector employment (Census County Business Patterns, 2022) × the national job-openings rate (about 4.3%; JOLTS August 2026 openings of 7.08M against about 159M jobs, secondary figure to verify). This is a rough estimate: local rates differ and CBP leaves out government. Coverage = our open postings / expected. First measure, 2026-10-22: Louisville area 9%, Washington County PA area 6%, Orleans Parish area 4%. A report prints "partial index" with that percentage. When the estimate can be replaced by a better local benchmark, replace it here.

## Employers and job systems (import data)
Open postings from the bulk import source by job system, 2026-10-22: Workday 37,400 (1,417 companies), Greenhouse 23,100 (1,267), Oracle 16,800 (329), Ashby 10,800 (1,075), iCIMS 8,300 (345), Lever 3,800 (381), Taleo 3,300 (70), SmartRecruiters 2,000 (43); 70,700 are aggregator links (many via Jooble), 233,500 are other or custom career sites (26,000 companies). About 5,100 companies show a job system the crawler can read. The crawler (`scripts/jobsreport/crawl.py`) has adapters for all of these except iCIMS. Crawling those employers directly gives full, fresher listings and lets the import be deduplicated.
Open question for the owner: the import appears to be aggregator-sourced (Jooble links); confirm the feed's terms before using it in a published report.
