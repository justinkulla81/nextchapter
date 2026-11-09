# Another 100,000 direct white-collar, college-level jobs (2026-11-09)

Owner ask: another 100k direct jobs for white-collar and knowledge workers, college educated, with AI skills. This builds on the plan to raise live direct jobs by 25% (crawler fixes and new sources only; the 14-day window does not change).

## What the board has now (a 1% block sample of live US direct jobs: 2,301 rows, scaled to about 235,000)

| | Share of direct | About |
|---|---|---|
| White-collar by SOC major group (11 to 29: Census groups 1 and 2) | 65% | 153,000 |
| No occupation code yet | 27% | 63,000 (some are white-collar) |
| Name an AI skill or tool (`aiSkillItems` or `aiToolsNamed`) | 14% | 33,000 |
| White-collar and name an AI skill | 10% (15% of white-collar) | 23,000 |

**College educated has no stored flag.** There is no "degree required" field (`requirementFlags` does not track it), so the working proxy is the occupation: SOC groups 11 to 29 are professional and managerial occupations. A degree-required detector in the crawler (the posting text says "bachelor's") would make this exact.

**Reading of the ask.** I read it as 100,000 more direct white-collar jobs, with AI skills as an attribute and filter. Today 15% of white-collar postings name an AI skill, so about 15,000 of the 100,000 would carry one (rising as postings catch up). If all 100,000 had to name AI skills, we would need about 660,000 more white-collar postings, which no source list supports.

## Where 100,000 more comes from

The 33 employers already found hold about 20,000 kept US jobs; tier 3 adds about 11,000; both are already in the 25% plan. For another 100,000 the crawler needs roughly 1,500 to 3,000 more employers' own boards, at about 35 to 70 kept US jobs each. Sources, largest first:

1. **More Workday employers.** The crawler reads about 1,087 Workday sources; many thousands of employers run Workday career sites.
2. **Greenhouse, Lever, Ashby and SmartRecruiters boards.** Dense in knowledge work and AI skills.
3. **Phenom, Eightfold, SAP SuccessFactors, iCIMS, Oracle HCM, Taleo, UKG.** About 40 employers found on these in tier 3 alone.
4. **Government and universities** (professional roles): NEOGOV, USAJOBS, higher-education systems.
5. **The 743 non-staffing employers that today appear only through aggregator copies** (about 40,000 rows; the list includes some junk boards).

## How to find the employers

The crawler computer can search the Common Crawl index for every employer career address on each job system (public data). It could not be reached from the cloud session (connection reset), so the prompt `docs/specs/ncrawl-enumerate-ats-prompt.md` is for the crawler session. Output: a ranked table of tenants with their US white-collar job counts, added in batches with dry runs.
