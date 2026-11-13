Goal: every cycle, add the career systems of employers that reach NextChapter through Jooble or Careerjet (more than one live job) as direct sources, so their jobs are on the employer's own system and can be offered to Google. Dry run first; do NOT import into production until the owner approves the counts. Work in this repo (`nextchapter-jobs`).

Inputs, in the nextchapter repo (the cloud session writes them; see `docs/jobs-report/go-direct-loop.md`):
- `scripts/jobsreport/sources/aggregator-direct-<date>.json`: sources in crawler format, high confidence. Add each not already a source (one source per board; match on tenant, token or host, not on employer name).
- `scripts/jobsreport/out/go-direct-review-<date>.json`: boards found under a shortened name. Verify the company on the board before adding.
- `scripts/jobsreport/out/go-direct-notfound-<date>.json`: employers with no readable system, ranked by aggregator rows. Build the adapter that unlocks the most rows (Phenom, Eightfold, SuccessFactors, iCIMS, Oracle HCM, Taleo, UKG, Avature, BrassRing), or find the system by following the Apply links on the career page.

Rules: career site and job system only, never the corporate site (CLAUDE.md "Employer discovery rule"); public endpoints, identified user agent, polite rate. US jobs only; do not change the seniority screen, report what it drops by level. Staffing firms and recruiters are fine when the jobs are real. Do not change the 1,500-byte description threshold or the 14-day window.

Do this
1. Add the sources, dry run, and report per employer: board jobs, kept after the US and level screens, aggregator rows it replaces.
2. Run the matcher (`direct_match.py`) in send mode after the direct rows are in, sending `duplicateOf` on each matched Jooble and Careerjet row. Report collapsed, blocked, unmatched.
3. Make sure each new source is re-crawled inside 14 days, and that descriptions are stored in full (null or short text keeps a job off Google).

Report back: sources added, funnel per employer, matcher results, adapters ranked by aggregator rows unlocked, anything you could not measure. Do not import to production, and do not guess numbers.
