# Go direct, every cycle: Jooble and Careerjet employers with more than one live job

Owner request, 2026-11-13: take every company that is in Jooble and Careerjet with more than one job, go direct, and index them directly. Do it again on a schedule, not once.

Why this works with the rules already in place: a job is offered to Google only when it is on the employer's own career system, confirmed open in the last 14 days, with a 1,500-byte description (`docs/jobs-report/direct-index-gap-2026-11-13.md`). Jooble and Careerjet rows stay on the board as the signal for which employers still lack a direct source. Each cycle shrinks that list.

## Size on 2026-11-13

18,703 employers have more than one live Jooble or Careerjet job (135,731 rows, `scripts/jobsreport/aggregator_employers.sql`). The list is long-tailed: the top 150 employers hold about 22,000 rows. Generic labels hold a lot of it and cannot go direct: "GPAC" (2,141), "Confidential" (1,848), "Clients blackbox" (442), "Work at home" (403). Staffing firms and recruiters stay in, as long as the jobs are real (owner decision 2026-11-13).

## The cycle (weekly)

1. **List.** Run `scripts/jobsreport/aggregator_employers.sql` once (CLAUDE.md "Database egress": one grouped pass, no loop). Save the JSON to `scripts/jobsreport/out/aggregator-employers-<date>.json`.
2. **Find the career system.** `python3 scripts/jobsreport/go_direct.py --employers <that file> --limit 150`, then `--offset 150`, and so on. Per employer it skips generic labels and employers already in `sources/*.json`, then looks at the career site and the job-system links on it (never the corporate site), then at the employer's own name as a board on Workday, Greenhouse, Lever, Ashby and SmartRecruiters.
3. **Verify.** `python3 scripts/jobsreport/verify_sources.py scripts/jobsreport/sources/aggregator-direct-<date>.json`. A board found by name is kept only when its own name or postings match the employer (the first pass rejected 47 of 177: Google's "Workday" board is an India operations centre, "Apex Systems" was "Apex Eye"). Rejects go to `out/go-direct-rejected-<date>.json`.
4. **Write sources** in crawler format to `sources/aggregator-direct-<date>.json` (high confidence), with a review list (a board found under a shortened name: confirm the company first), a not-found list ranked by aggregator rows (the next adapter to build, or a hand search that follows the Apply links), and a skipped list.
5. **Hand to the crawler.** `docs/specs/ncrawl-aggregator-direct-prompt.md` is the standing prompt for `nextchapter-jobs`, which is not reachable from the cloud session. Dry run first; the owner approves counts before import.
6. **Collapse.** Once the direct rows exist, the matcher sends `duplicateOf` on the aggregator copies (`src/lib/jobs/direct-replacement.ts`), so the employer drops off the next list.
7. **Measure.** Compare the employer count and row count in step 1 with last cycle's, and re-run `scripts/jobsreport/direct_index_gap.sql` once to see the offered-to-Google bucket move.

## First full pass (2026-11-13)

Results: `docs/jobs-report/go-direct-2026-11-13.md` (1,000 employers: 129 verified sources covering 7,050 aggregator jobs, 507 employers with no readable system).

## Limits

- Discovery finds a career system; it does not prove the crawler's US white-collar screens keep many jobs. Expect about a third of listed jobs kept (see the Workday tiers in `jooble-to-direct-phase2.md`).
- Guessing a platform address from a name finds about 11% of long-tail employers. The whole-platform enumeration in `docs/specs/ncrawl-enumerate-ats-prompt.md` reaches the tail; this loop is for the employers worth a named lookup.
