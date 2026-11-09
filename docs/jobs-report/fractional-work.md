# Fractional work: what we hold, the list, and how it shows (2026-11-09)

## What the board holds

Counted on the board's narrow copy of every row (`BoardLightRow`, all sources, not only live public pages; approximate):

| | By employment type | By title |
|---|---|---|
| Fractional | 789 | 817 |
| Interim | 1,424 | 1,460 |

By source of the 2,255 fractional or interim rows: aggregators 1,569, search firms 276, employers 203, the dedicated `interim` source 94 (93 of them fractional), venture boards 42, and a few from other boards and associations. Titles are mostly fractional CFO, CMO, COO, HR director, head of product or marketing, accounting, in-house counsel, recruiting and cybersecurity; "Fractional Chief AI Transformation Officer" appears too.

**The catch:** most fractional jobs reach us through aggregators or staffing firms (for example Cherry Bekaert, Kforce, Go Fractional, B2B CFO), not an employer's own career system. Under the direct-only indexing rule (2026-11-04) those job pages are not offered to Google. Only about 200 employer rows and some search-firm and `interim`-source rows can be.

## Before this change

- A fractional job was filed under "Part-time" (`work-type.ts` maps `fractional` to `part_time`, labelled "Part-time & fractional"). No card, job page or search engine was told it is fractional.
- Google's job data (`JobPosting`) carried no `employmentType` for it (the fractional and interim types were left out on purpose).
- There was no public page for fractional work. `/jobs/type/` had remote, hybrid, contract, part-time and interim only. Members had a directory of fractional marketplaces (`InterimListing`, 27 rows) behind sign-in.

## What this change does

- `isFractionalJob` (`src/lib/jobs/work-type.ts`): the employment type is `fractional`, or the title says "fractional".
- Job cards show a **Fractional** chip instead of "Part-time".
- The public job page says "Fractional, part-time" beside the place and pay.
- Google's job data sends `employmentType: PART_TIME` for a fractional job (a fractional role is part-time by definition; the title already says "Fractional").
- New public page **https://launchyournextchapter.com/jobs/type/fractional**, in the sitemap and linked from the job-type chips. The interim type now also counts jobs whose title says "interim", not only those the crawler typed. The page stays out of search until the next board-figures run has counted its jobs.

## The list: fractional and interim marketplaces we already track (27, `InterimListing`)

- **General and any function:** Business Talent Group, Catalant, GigX, NeoGig, Braintrust, Fractional Jobs (fractionaljobs.co), Prolific.
- **Marketing:** Chief Outsiders, MarketerHire.
- **Startup:** Bolster.
- **Technical and AI:** Toptal, Turing, Mercor, micro1, Labelbox, Scale AI, Surge AI.
- **Expert networks:** AlphaSights, GLG, Guidepoint, Third Bridge.
- **Board and advisory:** BoardProspects, NACD, Athena Alliance (women-focused), theBoardlist (women-focused).
- **Nonprofit board and skilled volunteering:** BoardSource, Catchafire.

## Open decisions (owner)

1. **Direct rule and fractional.** To get fractional jobs indexed, we need them from a first-party source. The candidates are the fractional marketplaces' own posting pages (Fractional Jobs and similar), the `interim` source the crawler already has, and the fractional practices of accounting and search firms. Decision: do marketplace-hosted postings count as direct, as search-firm postings do today? Check each marketplace's terms and `robots.txt` before crawling.
2. **`interim` source in the direct rule.** `PUBLIC_JOB_SEARCH_SQL` counts `directListing` or `sourceCategory = 'employer'`. The 94 `interim`-source rows are not counted unless the crawler flags them direct.
3. **Member search.** The board type is still "Part-time & fractional" (no separate filter), and cards now say Fractional. A separate Fractional filter would change saved board preferences and URLs, so it is not part of this change.
