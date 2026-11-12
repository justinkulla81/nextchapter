Goal: reduce the NextChapter board's dependence on Jooble by (1) collapsing Jooble copies into direct rows and finishing the crawls that feed them, (2) converting the largest Jooble employers to their own career-system boards, and (3) covering the long tail by job-system platform. Dry run first; do NOT import into production until the owner approves the counts. Work in this repo (`nextchapter-jobs`). Full findings are in `docs/jobs-report/jooble-footprint-and-plan.md` and `docs/jobs-report/jooble-to-direct-phase2.md` in the nextchapter repo.

Context (production, 2026-11-12)
- About 94,800 live US jobs link through Jooble across about 40,300 employers: 3,056 employers already have direct rows (13,451 Jooble rows, 14%), 7,472 look like staffing or recruiters (22,844, 24%), 29,819 other employers hold 58,526 (62%, about 2 rows each).
- Live direct jobs fell from 243,418 (Nov 8) to 227,832 (Nov 12). About 94,000 direct rows are hidden because the crawler has not re-verified them in 14 or more days. The first fixed daily sync was due around Nov 10 and had not landed in production by Nov 12.
- Rules: career site and job system only, public endpoints only, identified user agent, polite rate. US jobs only. Do not change the seniority screen; report what it drops, by level.

1. Collapse and finish crawls
a. Report where the first fixed daily sync is: finished or not, how many boards completed, partial or failed, and when its import ran. If it finished, say why production did not change.
b. Check these boards against your logs and fix what you find. Production shows (live direct, hidden-stale direct, newest verification):
   - Not crawled since mid-October: Accenture (0, 521, Oct 15), Verizon (0, 226, Oct 18), General Motors (0, 512, Oct 22), Wolters Kluwer (0, 129, Oct 19), Boeing stored as "The Boeing Company" (1, 467, Oct 31), Flex stored as "Flex" (0, 178, Oct 16).
   - Crawled recently but only a slice re-verified: Morgan Stanley (4 live, 609 hidden; the board lists 857 US jobs), Salesforce (1, 362; board 569 US), State Street (3, 360; board 543 US), Capital One (77, 608), Booz Allen (80, 530), Nvidia (99, 369), Johnson Controls (4, 394), Palo Alto Networks (36, 258).
   - Source mismatches: Micron's rows come from micron.eightfold.ai, not its Workday board; JLL has only 3 rows ever.
   - Not yet in production: the Goldman Sachs and TikTok adapters.
   - Direct rows can sit under another company name (M&T is "Manufacturers and Traders Trust Company", AIG is "American International Group"), so match by tenant, not by name.
c. Run the matcher (`direct_match.py`) in send mode once the direct rows are in, sending `duplicateOf` on each matched Jooble row. Report collapsed, blocked and unmatched, per employer, for the 3,056 employers that already have direct rows.

2. Convert the largest Jooble employers
The first 33, tier 3 (25 boards) and tier 4 (9 boards, plus Revolution Medicines on Greenhouse) are listed in `scripts/jobsreport/sources/jooble-top.json`, `jooble-next.json`, `jooble-tier3.json` and `jooble-tier4.json` in the nextchapter repo. Add any not yet sources, dry run, and report the funnel per employer. Then continue down the list of employers with 20 or more Jooble rows (about 280; about 90 done). Build adapters for the systems with many employers: Phenom, Eightfold, SAP SuccessFactors, iCIMS, Oracle HCM, Taleo, UKG, Avature, BrassRing. Rank the adapters by Jooble rows unlocked.

3. Cover the long tail by platform
Enumerate every employer on Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee and similar public platforms (the Common Crawl method in `docs/specs/ncrawl-enumerate-ats-prompt.md`), ingest all their US white-collar jobs, then match Jooble employers to them. A pilot from the cloud (guessing the platform address from the employer's name, on 195 random long-tail employers) found a readable board for 38, of which about 22 were the right company. Guessing finds only about 11%, so use the enumeration, and verify the company name on every match (the single-first-word address variant produced false matches such as "general", "maple", "air", "sierra", "applied"). Report: employers enumerated per platform, the US white-collar jobs they hold, the share of Jooble's 40,300 employers that gain a direct source, and how many Jooble rows that covers.

Report back: sync status, per-employer fixes and funnel tables, matcher results, ranked adapters, platform coverage, and anything you could not measure. Do not import to production, and do not guess numbers.
