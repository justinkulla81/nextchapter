# Handoff to the jobs (ncrawl) session

Paste this into the session that runs `ncrawl` (the "NC job frequency" session is archived, so start a new one in `/Users/salitkulla/nextchapter-jobs`). Written 2026-10-15 by the Monthly white collar jobs report session.

Context, current gaps and the data contract: `docs/specs/NextChapter_Jobs_Report_Spec.md`, `docs/jobs-report/louisville-coverage-plan.md`, `docs/jobs-report/louisville-employer-targets.csv` on branch `claude/exciting-johnson-lcf7h8` of justinkulla81/nextchapter.

## Goal

Monthly White Collar Jobs Report. First run: Louisville / Jefferson County KY plus the broader Louisville metro (including Southern Indiana counties). Target: at least 50% coverage of openings in each of two frames: (1) all jobs, every level including entry-level and hourly; (2) mid-level and above.

## What the report session found (ExclusiveJobPosting, 2026-10-15)

- 815 rows match "louisville"; about 735 are Louisville, KY. 74 are Louisville, CO and 44 are unclear. Location strings are inconsistent.
- 518 of 815 (64%) come from the Jooble aggregator, but `source` says `ats_feed` for every row.
- Large Louisville employers with zero postings: UPS, Kroger, Jefferson County Public Schools, Louisville Metro Government, Louisville Water, MSD, Wells Fargo, Texas Roadhouse, Dinsmore, Bellarmine, Spalding, JCTC, Amazon, Walmart, Lowe's, Home Depot. Too few: Ford (2), Norton Healthcare (7), University of Louisville (1), Commonwealth of Kentucky (1), PNC, Fifth Third, JPMorgan.

## Requests, in priority order

1. **Employers.** Check which employers in `louisville-employer-targets.csv` exist in the `employers` table and are `ats_status` resolved. Resolve and crawl the rest directly (careers URL, ATS type, tenant/site), largest first. Use `metro`, `city`, `state` to tag the Louisville area.
2. **Public sector.** NEOGOV/governmentjobs.com (Louisville Metro, JCPS, state, UofL), the Kentucky state jobs portal, KCTCS, USAJOBS API filtered to Jefferson County.
3. **Staffing firms and recruiter boards** for Louisville.
4. **Long tail.** Add a second and third aggregator beside Jooble and deduplicate across sources (employer + normalized title + location).
5. **All levels.** The rank floor (rank 40 or above) and the 30-day posted window drop entry-level, hourly and older postings (about 21k screened out per run). Keep them in a separate flagged store or a no-floor mode, with the level and a reason code. Do not delete screened-out rows. Needed for the all-jobs frame and for old-job and ghost-job analysis.
6. **Marketplace sources for the 1099 chapter** (expert networks, AI-training marketplaces, fractional and interim executive platforms, freelance boards for professional work). List candidates first and check terms of use and robots.txt before crawling anything. Skip any that disallow it.

## Fields to store (raw text and dates; derive the rest later)

- Full description text with sections preserved; version history when text changes; description hash.
- Original title; requisition or ATS job ID; employer name as posted; employer domain.
- Source type: direct ATS, aggregator, search firm, marketplace, public sector. Posting URL and source ID.
- Location as posted, parsed city and state, county code, and the full location list for multi-location postings.
- Work arrangement flag from the source if exposed.
- Pay min, max, currency, period, and whether pay is stated or board-estimated; employment type; hours or contract length if given.
- Level (all levels), function, industry with NAICS, SOC occupation code if possible.
- Source posted date with precision and time zone; source "updated" date.
- first_seen, last_seen, per-run presence; a closed date set after absence across N consecutive runs. Never overwrite older versions.
- Per run, per source: fetched count, failures, run date.
- Benefits block if separable; EEO boilerplate flagged.

## Delivery

The report session cannot read `jobs.db` (it lives on Justin's Mac). Load the data into new tables in the NextChapter Supabase project (`uvoulytrsrxasqzutlmq`), or export a SQLite or Parquet file to a location the report session can open. Include the schema. Do not change existing `ExclusiveJobPosting` columns.

Report back when sources are in and the data is readable, and flag anything that is infeasible or disallowed.

## Update 2026-10-15: all jobs reports need all white-collar levels (standing rule)

Every jobs report, local and national, must cover all white-collar jobs at every level, entry-level included, not only mid-level and above. White-collar = Census major occupation groups 1 and 2 (management, business and financial; professional and related). Stop screening out entry-level white-collar postings (analysts, associates, coordinators, trainees, junior roles) for the Louisville metro and for any metro crawled for a local report. Store the level (add an `ENTRY` level) and an occupation group tag (SOC major group, or a `white_collar` flag with the rule that set it) on every posting. Keep the non-white-collar postings too, flagged, for the all-jobs frame.
