# NextChapter White Collar Jobs Report: spec

Status: draft v0.1, 2026-10-15. Nothing here is built yet.

A monthly report on what employers are posting, a sibling of the White Collar Employment Report. The Employment Report says what people experience (Census, BLS). This report says what employers ask for (public postings). Public data only; no member data.

## Frames (every figure is labeled with one)

| Frame | Contents | Compared against |
|---|---|---|
| **All jobs** | Every level, entry-level and hourly included | WARN layoffs (all levels), BLS JOLTS openings, BLS employment |
| **Mid-level and above** (core) | Mid-level IC and up | Our own history, white-collar occupation benchmarks |

**Standing rule, local and national reports: the primary frame is all white-collar jobs at every level, entry-level included.** White-collar means Census major occupation groups 1 and 2 (management, business and financial; professional and related), the same definition the Employment Report uses. The crawler must keep entry-level white-collar postings (analysts, associates, coordinators, trainees) and tag each posting's occupation group, so the local and national reports share one scope. The "mid-level and above" frame below is a secondary cut, never the headline. The all-jobs frame also stays secondary.

Rules: never blend frames into one number. WARN has no levels, so it is compared only with the all-jobs frame and shown as labeled context in the mid-level frame. Show both frames side by side where the question allows; present one frame alone where a comparison would not be apples to apples. Within each frame, W-2 and 1099 are reported separately.

## Chapters

1. Summary (W-2 headline, 1099 second line).
2. Postings we index: counts and change by industry, function, seniority, geography; coverage box; weekly and day-of-week postings; postings versus announced layoffs for the month.
3. Employers: one job, several, several locations; hiring while firing; what is hired versus cut.
4. Pay.
5. Benefits ("mentioned in", never "offered by").
6. Remote, hybrid, on-site.
7. Skills and EQ: skills map, pivot map from shrinking to growing, value of EQ skills, how EQ is communicated in AI versus non-AI postings.
8. Old jobs, reposts and ghost jobs (ghost risk, not "fake").
9. AI (all AI topics): who asks for AI by function, industry, seniority, location, skills; growth and decline in AI demand; AI versus non-AI postings (matched); skills moving with AI; AI exposure bands, near term and longer term; AI-training work; AI washing.
10. Contract, fractional, interim, gig (1099).
11. Net job growth versus industry growth (BLS CES employment, BEA value added, our hiring signal).
12. Watch list, release calendar, methodology and limits.

## Rules carried over from the Employment Report

- Every number carries its period and its source panel.
- Compare adjacent months only on a same-source panel and only above a stated noise threshold.
- Say what the data shows; never say AI caused a change.
- Label NSA (not seasonally adjusted) until three years of history exist. Year over year after 12 months.
- Ghost, exposure and "AI-training" labels are classifications with published, versioned methods.
- No named-employer claims in edition one.

## Definitions

- **Ghost risk:** reuse `src/lib/jobs/ghost-risk.ts` (likely: posted and closed 2+ times, or open 90+ days; watch: 60+ days or one repost). Report counts by level; keep the code and report in sync.
- **AI demand levels:** AI is the job; AI tools as a named skill; no AI mention. Boilerplate-only mentions are counted and reported separately.
- **AI exposure:** occupation-level published exposure scores (stable, citable) plus task signals from posting text (near term). Exposure, not a forecast of job loss.
- **Engagement type:** W-2 full-time, W-2 part-time, 1099, contract-to-hire, fractional, interim, gig/project, expert-network or likely AI-training work.
- **Work arrangement:** remote (anywhere in the US), remote (state-restricted), hybrid, on-site, unspecified.
- **Geography:** normalized county code and metro membership, not text matching.

## Data contract for the jobs (crawler) session

Store raw text and dates; derive fields from them.

Per posting:
- Full description text with sections preserved (responsibilities, requirements, nice-to-have); text version history.
- Original title; normalized title; requisition or ATS job ID; description hash.
- Employer name as posted, employer domain, parent company where known, company size band and type.
- Posting URL, source ID, **source type (direct ATS, aggregator, search firm, marketplace, public sector)**.
- Location as posted, parsed city/state/country, county code, **list of locations for multi-location postings**.
- Work arrangement flag from the source, if exposed.
- Pay min, max, currency, pay period, **whether pay is stated or board-estimated**; employment type; hours and contract length if given.
- Level (all levels, including entry-level and hourly), function, industry with NAICS crosswalk, SOC occupation code if possible.
- Posted date from the source, with its precision and time zone; source "updated" date.
- first_seen, last_seen, and per-crawl-run presence; closed date set after absence across N consecutive runs.
- Benefits block if separable; EEO boilerplate flagged.

Per crawl run, per source: fetched count, failures, run date, weekday. Keep history; never overwrite older versions.

Sources to add or confirm: direct employer ATS for the largest employers per metro; NEOGOV/governmentjobs; USAJOBS; staffing firms and recruiter boards; expert-network, AI-training, fractional and interim marketplaces (check terms of use and robots rules first); a second and third aggregator with cross-source deduplication.

## Outside data the pipeline pulls

BLS CES and JOLTS, BEA GDP by industry, BLS QCEW, Census/BLS metro employment, WARN (existing `WarnNotice` table plus `scripts/warn/`), layoffs.fyi (`scripts/layoffsfyi/`), Challenger announcements (as in the Employment Report), SEC filings (existing). Add BLS and BEA API keys to `.env.local`.

## Files (siblings of the Employment Report)

| Employment Report | Jobs Report |
|---|---|
| `src/app/reports/displacement-report-<month>-<year>/` | `src/app/reports/white-collar-jobs-report-<month>-<year>/`, shared `report-styles.ts` |
| `REPORT_EDITIONS` in `src/lib/reports.ts` | a parallel `JOBS_REPORT_EDITIONS` list and slug helper in the same file |
| `scripts/displacement/` | `scripts/jobsreport/` (Python reads the jobs database read-only, writes JSON and CSV) |
| `npm run report:index`, `report:companions` | `npm run report:jobs -- --month YYYY-MM [--geo jefferson-ky-metro]` |
| PDF, brief, carousel builders | same builders |
| `public/reports/*.csv` | `public/reports/jobs-report-<yyyy-mm>-*.csv` |
| replication page, sitemap, news feed, `llms.txt`, IndexNow | one entry each |

The pipeline takes a geography parameter so the Louisville run is the first of many.

## Instrumentation (per CLAUDE.md)

`jobs_report_viewed`, `jobs_report_section_viewed`, `jobs_report_pdf_downloaded`, `jobs_report_data_downloaded` (`{ edition, file }`), `jobs_report_newsletter_signup` (`{ edition, source }`).

## Phasing

1. Core: counts, geography, arrangement, pay, reposts and ghost risk, employer concentration.
2. Text-derived: skills, EQ, AI demand, benefits, culture language.
3. AI exposure bands and trends; skills pivot map.
4. 1099 and alternative work (depends on sources the crawler can legitimately reach).
5. Hiring while firing; net job growth versus industry growth.

## Louisville / Jefferson County first run

See `docs/jobs-report/louisville-coverage-plan.md` and `docs/jobs-report/louisville-employer-targets.csv`. Geography: Jefferson County, KY and the broader Louisville metro (including Southern Indiana counties). Output is a draft for review, not a public page. Coverage target is 50% or more in each frame, measured by employer coverage and a sampled opening-coverage check.
