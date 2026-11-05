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

Goldman Sachs (Jooble 65, direct 0), Jacobs (81, 0), ADP (151 across two names, 0), TikTok (73, 0), AECOM, Stantec, Deloitte, Lockheed Martin, Google, Apple, PwC, KPMG, Walmart: either a custom system (not Workday) or a Workday site name not guessed. Lockheed, Deloitte, Google, Apple, PwC, KPMG, Walmart, AECOM and Stantec already have direct rows, so their crawler source exists; the Jooble remainder is a coverage gap to look at in ncrawl (see `ncrawl-google-gap-prompt.md`). The rest need the job system found by following the Apply links on their career page.

## Staffing and recruiter firms (do not chase)

Robert Half (866 via Jooble), CyberCoders (365), Jobot (343), LHH (327), Insight Global, Apex Systems, Kforce, Mindlance, HAN Staffing, Addison Group, Acturhire, Green Key, Artech, Motion Recruitment, Vaco, Randstad, Experis, Ampcus and similar. The posting is the recruiter's own listing for an unnamed client; the apply link is not a copy of a client's career-site job. Decision for the owner: keep them out of search (current rule) or index the ones whose own career site posts the job.

## "Confidential" (1,002 jobs)

Not an employer. Each is a recruiter's listing with the client hidden. Cannot be made direct.

## Next steps

1. In ncrawl, add the ten boards above as `direct_ats` Workday sources, run, import, and compare direct counts per employer with the table.
2. For each employer, archive or demote its Jooble rows once the direct row for the same requisition exists (dedupe on employer, normalized title, location).
3. Find the systems for the not-found list; continue down the Jooble list by volume.
4. Track the Jooble share of live jobs and the direct count for these ten weekly (the admin Job source chart, `JobSourceShareChart`, already splits Direct and Jooble).
