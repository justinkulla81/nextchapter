Goal: add 23 more employers' own Workday career boards as direct sources in this repo (`nextchapter-jobs`, ncrawl), so their US jobs come in as direct listings (`directListing` true, `sourceCategory` 'employer') instead of through Jooble. Same job as the first ten: reuse that work. Dry run first; do NOT import into production until the owner approves the counts.

Context
- About 1,040 live US jobs for these employers link through jooble.org, with few or no direct rows. Google is offered only direct employer-system jobs.
- Rule: use the employer's career site and job system, never its corporate site. Public Workday endpoints only, identified user agent `NextChapterResearch/1.0 (research@launchyournextchapter.com)`, polite rate.
- US jobs only (keep the existing US screen). Jobs reports cover all white-collar jobs at every level, entry-level included; do not change the seniority screen, report what it drops by level.
- The Workday fixes (crash, `us_only`, unlevelled-title fetch, "30+ days" repost check) and `direct_match.py` from the first ten are assumed applied. A matched Jooble row is sent with `duplicateOf` set to the direct row's URL; the import collapses it only into a live, recently verified, direct row.

The boards (all verified 2026-11-07; tenant, cluster, site; live via Jooble / live direct now)
Hitachi hitachi wd1 hitachi 59/0; Johnson Controls jci wd5 JCI 58/0; KBR kbr wd5 KBR_Careers 57/7; Micron micron wd1 External 55/4; Capital One capitalone wd12 Capital_One 55/286; Boeing boeing wd1 EXTERNAL_CAREERS 54/4; Guidehouse guidehouse wd1 External 53/86; Morgan Stanley ms wd5 External 50/1; Home Depot homedepot wd5 CareerDepot 49/3; RSM rsm wd1 RSMCareers 46/0; Palo Alto Networks paloaltonetworks wd5 panwexternalcareers 44/118; Stryker stryker wd1 StrykerCareers 43/85; Centene centene wd5 centene_external 42/8; Verizon verizon wd12 verizon-careers 42/0; General Motors generalmotors wd5 Careers_GM 41/0; The Hartford thehartford wd5 Careers_External 41/0; Wolters Kluwer wk wd3 External 38/0; Merck msd wd5 SearchJobs 37/4; Truist truist wd1 Careers 37/0; AIG aig wd1 aig 36/0; Flextronics flextronics wd1 Careers 35/0; Gartner gartner wd5 EXT 34/18; M&T Bank mtb wd5 MTB 34/0.
They are also in the nextchapter repo at `scripts/jobsreport/sources/jooble-next.json` and `docs/jobs-report/jooble-to-direct-phase2.md`.

Do this
1. Add the 23 boards as Workday sources the same way as the first ten. Handle Workday's 2,000-result cap for boards with more (Hitachi, Johnson Controls, Micron, Capital One, KBR). Several employers (Capital One, Morgan Stanley, Home Depot, Guidehouse, Stryker, Palo Alto Networks) already have direct rows from another source: find which and avoid double-counting.
2. Dry-run (no upload). Per employer report the funnel: listed, fetched, non-US dropped, seniority/title screen drops by level, rank floor, posted-date window, duplicates, kept. Compare kept US jobs with the two columns above.
3. Run `direct_match.py`: how many Jooble rows would collapse, how many are blocked and why, how many Jooble rows have no direct row (the coverage gap).
4. Confirm liveness keeps `lastVerifiedAt` fresh for the new sources.
5. Separately, check Uber (Oracle HCM, jobs.uber.com), Ford (careers.ford.com, Radancy), AMD (iCIMS and Jibe), Honeywell and BMO (Phenom), New York Life and Leonardo DRS (SuccessFactors), Takeda (Avature) for a public endpoint, and say which the existing adapters already cover.

Report back
A funnel table per employer, the files changed, match results and a recommendation. Mark anything you could not measure. Do not import to production, and do not guess numbers.
