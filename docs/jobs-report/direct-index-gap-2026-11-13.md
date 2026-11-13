# Direct jobs and Google: what is offered, what is left out, and why (2026-11-13)

Goal (owner, 2026-11-13): every direct job page is indexed by Google; Jooble, Careerjet and the other aggregator rows stay on the board only as the signal for which employers still need a direct source. Go exclusively direct.

The rule already works that way. Since the 2026-11-04 owner decision a job page is offered to Google (sitemap, IndexNow, Indexing API) only when the job is on the employer's own career system (`directListing`, or `sourceCategory` 'employer'). An aggregator job keeps its page for members, is `noindex`, is out of the sitemap, and is reported to Google as removed. The offer also needs the job confirmed open in the last 14 days and a description of 1,500 bytes or more (`src/lib/jobs/public-job-page.ts`). This report is about the direct jobs that fail one of those two tests.

## Method and limits

One 10% block sample of live jobs (status approved, not archived, no close reason), 2026-11-13, on three narrow columns plus description length. Estimates are the sample times 10 (the whole-board figures use a 3% sample, times 33). Block sampling is not random by row, so treat figures as estimates, good to a few percent for the totals and to roughly a third for a single employer. The totals sit about 10% above the real sitemap (204,000 estimated against 184,519 in the sitemap on 2026-11-12), the difference being rules the sample does not apply (US only, ghost-job, expired). The query is `scripts/jobsreport/direct_index_gap.sql`; run it once and keep the result.

What this does not measure: how many offered pages Google has actually indexed. That check is the URL Inspection sampler on the admin Visitors page and needs an admin login.

## The board

| Live jobs | Estimated | Share |
|---|---|---|
| All live | 573,000 | |
| Aggregator or other (not direct) | 220,000 | 38% |
| Direct | 352,000 | 62% |

## Direct jobs: offered, and what keeps the rest out (corrected, 10% sample times 10)

This replaces the first version, which skipped the sitemap's other fixed rules (US only, internships, reopened jobs) and so overstated the offered count (204,000). Buckets are mutually exclusive, in the order a job meets the rules (the sitemap SQL, `public-job-page-server.ts`); the sample held 35,520 live direct jobs.

| Direct jobs | Estimated | Share |
|---|---|---|
| Offered to Google | 189,000 | 53% |
| Confirmed open 14 to 30 days ago (good text, hidden only for that) | 86,000 | 24% |
| Location unknown: no country and no state stored | 30,000 | 8.6% |
| No description stored | 24,000 | 6.9% |
| Description under 1,500 bytes | 17,000 | 4.9% |
| Reopened or reposted twice or more | 4,200 | 1.2% |
| Outside the US | 3,200 | 0.9% |
| Confirmed over 30 days ago, or an internship | 100 | |

Location unknown is the new finding. These jobs are dropped as "not in the US" only because the crawler stored no structured location. Their text says "Remote" or "Multiple Locations", or is empty, so no safe fix exists from our side: the crawler already screens out non-US jobs, so it should record country US (or the state) on what it keeps. Fractional work: about 300 live rows in all (sample), 220 of them aggregator, 50 on the `interim` source (fresh, but their text is short), a handful from employers, search firms and venture boards.

## Levers, by jobs recovered

1. **Stale confirmation: 86,000 jobs.** The cron `direct-reverify` (2026-11-13, `src/lib/jobs/direct-reverify.ts`) checks them hourly through the employer system's public job API or the page's own job data, the way a member's click does, and refreshes the live ones. On a 13-job test most Workday jobs answered live and the rest were unclear (HTTP 403) and left alone; none was wrongly called dead. The crawler's re-check cadence is still the better fix.
2. **Missing or short text: 41,000 jobs** (crawler).
3. **Location unknown: 30,000 jobs** (crawler).
4. **Rules widened** (the third, 2026-11-13: venture, PE, association, accelerator and women-board listings, about 16,000 more offerable on the sample, 12% of them sharing a company and title with a job already offered; one list, `OFFERED_SOURCE_CATEGORIES`, to take any back out): an employer ATS link counts as direct (about 3,200 more offerable) and search firms and the `interim` source count as direct (about 6,100 more offerable, a 10% sample reading).

Not recommended: lengthening the 14-day window, or lowering the 1,500-byte threshold (stubs, not near-misses).

## By employer (estimated jobs; from `direct_index_gap.sql`, section 2)

Staffing and recruiting firms are included: their postings count as direct when the job is real (see the check below).

**Direct text missing or short, fresh (lever 1)**

| Employer | Est. jobs | Offered now |
|---|---|---|
| JPMorgan Chase | 2,040 | 0 |
| RTX | 1,300 | 270 |
| Apple | 1,220 | 130 |
| BAE Systems | 940 | 300 |
| Oracle | 830 | 190 |
| Hewlett Packard Enterprise | 360 | 270 |
| Google | 260 | 0 |

**Direct, stale (lever 2)**

| Employer | Est. jobs | Offered now |
|---|---|---|
| Raytheon Company | 1,460 | 180 |
| Deloitte | 1,130 | 0 |
| TEKsystems (staffing) | 1,040 | 20 |
| CACI International | 940 | 200 |
| Microsoft | 950 | 10 |
| Sargent & Lundy | 830 | 10 |
| Publicis Groupe | 760 | 0 |
| Blue Origin | 750 | 0 |
| Northrop Grumman | 720 | 970 |
| Morgan Stanley | 720 | 230 |
| Booz Allen Hamilton | 650 | 200 |
| General Motors | 570 | 300 |
| Capital One | 550 | 330 |
| Leidos | 520 | 740 |
| Salesforce | 480 | 180 |
| Thermo Fisher | 590 | 0 |
| PwC | 540 | 0 |
| Nvidia | 370 | 330 |
| Bank of America | 360 | 370 |

Check one: "Top Echelon Network (recruiter member boards)" (680 stale) and "APA International Placement Consultants" (440) are recruiter boards. Owner decision 2026-11-13: staffing firms and recruiters are fine as long as the jobs are real. So the test is the job, not the firm: a live posting on the firm's own system with a real title, employer or client, and location, not a talent-pool or "general application" listing and not a copy of another board. The crawler should report what share of these boards' rows pass that test.

**Aggregator copies and no direct jobs offered (the find-a-direct-source list)**

| Employer | Aggregator jobs | Direct offered | Note |
|---|---|---|---|
| Google | 1,500 | 0 | Direct rows exist but are stale or short text |
| Saab | 870 | 0 | |
| Maximus | 810 | 0 | in the 2026-11-12 zero-direct list |
| Anduril | 750 | 0 | 2026-11-12 list says direct rows exist from another source |
| Chronosphere | 720 | 0 | |
| Citi | 690 | 0 | Workday board known (citi, wd5) |
| Uline | 650 | 10 | |
| CVS Health | 640 | 0 | in the 2026-11-12 zero-direct list |
| Yo AI Labs | 610 | 0 | |
| Opower | 520 | 0 | |
| Capital One | 700 | 330 | |
| Amazon | 1,280 | 8,460 | direct is large; aggregator copies are the remainder |

Left out as not real postings: "Remote", "Work at home", "Confidential", "Clients blackbox" and "GPAC" are generic or unnamed labels; they need a real employer or client name before they count. Staffing and recruiting firms (Creative Financial Staffing, Michael Page, Robert Half, Actalent, Aston Carter, Jobot, TEKsystems) stay in.

## Rule widened (2026-11-13)

Owner decision: a job is direct when its link is on an employer applicant tracking system (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, iCIMS and the other hosts in `src/lib/jobs/employer-ats.ts`), whichever feed it came through. An aggregator's row is never direct. A venture, PE or accelerator board's own page (getro.com, jobs.accel.com and the like) is still not.

Measured on the 3% sample before the change: 6,594 live jobs were not direct. Of those, 176 (about 5,900 on the board) link to an employer ATS, and 97 (about 3,200) also have the full text and a confirmation within 14 days, so about 3,200 jobs become offerable at once, about 1.6% more than the 204,000 offered. 14 of the 97 share a company and title with a direct row we already hold, which may be the same role in another city or a true duplicate; check after deploy. The other roughly 58,000 jobs from venture, PE and school or women's boards link to those boards' own pages and stay out.

## Next

Crawler prompt: `docs/specs/ncrawl-direct-index-gap-prompt.md`. The crawler (`nextchapter-jobs`) is not reachable from the cloud session. Re-run `scripts/jobsreport/direct_index_gap.sql` after the crawler changes land to see the buckets move.
