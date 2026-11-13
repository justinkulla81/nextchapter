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

## Direct jobs: offered, and what keeps the rest out

| Direct jobs | Estimated | Share of direct |
|---|---|---|
| Offered to Google | 204,000 | 58% |
| Kept out: last confirmed 14 to 30 days ago (good text) | 82,000 | 23% |
| Kept out: no description stored at all | 39,000 | 11% |
| Kept out: description under 1,500 bytes | 26,000 | 7.5% |

Of the 65,000 with missing or short text, about 45,000 were confirmed open in the last 14 days, so they would be offered the day the text is fixed. No direct job was last confirmed more than 30 days ago (the board hides those). The earlier note that the 11% had "no verification date" was wrong: all have dates; they have no description.

## Levers, by jobs recovered

1. **Missing or short text, fresh jobs: about 45,000 jobs.** Fastest, because these are already confirmed open. The existing prompt `docs/specs/ncrawl-full-description-prompt.md` sized only the short stubs (about 9,500). The 39,000 with no description at all are a larger and separate problem: the adapter stores nothing.
2. **Stale direct jobs: about 82,000 jobs.** The crawler holds the rows and has not re-checked them in 14 days. The fix is re-verification cadence, not new sources.
3. **Employers with only aggregator copies:** the section below. Smaller in jobs, but they are the point of keeping the aggregator rows.

Not recommended: lengthening the 14-day window. It would offer the 82,000 stale jobs but also closed ones, and expired job markup is a quality risk with Google. The 1,500-byte threshold also stays (stubs, not near-misses).

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

## Next

Crawler prompt: `docs/specs/ncrawl-direct-index-gap-prompt.md`. The crawler (`nextchapter-jobs`) is not reachable from the cloud session. Re-run `scripts/jobsreport/direct_index_gap.sql` after the crawler changes land to see the buckets move.
