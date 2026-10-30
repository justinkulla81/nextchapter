# Job distribution: who will take NextChapter's jobs

Research date 2026-10-30. Public documentation only. Nothing was submitted, registered or agreed to.
Several partner pages returned 403 to our fetcher (WhatJobs, Jobrapido, Adzuna's spec, ZipRecruiter's import page, Handshake's feed guide); facts taken from search snippets or third parties are marked *(second-hand)*. "Not found" means not found, not "no".

## What we are offering

About 650k live professional jobs crawled from employer career sites and ATS pages. Each has a direct apply link on the employer's site. We are not the employer and do not own the postings. About 176k of them pass the public-page allowlist (`src/lib/jobs/public-job-page.ts`) as of 2026-10-26.

The test for every partner: does it take a feed from a site that aggregates other people's jobs, and does it send traffic for free?

## The finding that matters most

**No partner publishes a rule that allows or forbids aggregator-sourced jobs, except the two biggest, and both forbid it.**

- Indeed: "Aggregators are not allowed on Indeed." https://uk.indeed.com/help/employers/articles/360018069792 A narrower "distributor" route exists, sponsored-only, from one feed, with no job-board content. Single-source feeds also lose organic visibility from 2026-03-31 (https://in.indeed.com/help/employers/articles/single-source-feed-policy-effective-march-31-2026). Glassdoor takes its jobs from Indeed (*second-hand*: https://support.brightmove.com/en/articles/10622198), so it is closed too.
- LinkedIn: "Ensure to exclude jobs from the feed that are aggregated from other third-party sites." https://learn.microsoft.com/en-us/linkedin/talent/job-postings/xml-feeds-development-guide

The mid-tier aggregators (Jooble, Talent.com, Careerjet, Adzuna, Jobrapido, WhatJobs) are themselves aggregators and publicly say they crawl other boards (Jooble: https://help.jooble.org/en/support/solutions/articles/60000037108; Careerjet indexes sites with no feed: https://www.careerjet.com/contact-us). They are the realistic fit.

## Ranked table

Reach is the partner's own claim unless noted. Fit = does our kind of content (aggregated, employer apply link) match what they take. Terms risk = chance that registering us breaks a term we could not see or that employer-consent rules apply. Effort = engineering plus owner work on top of the feed.

| # | Partner | Reach | Fit | Terms risk | Effort | Evidence |
|---|---|---|---|---|---|---|
| 1 | **Jooble** | ~90M candidates a month, 66 countries (self-reported); 35.5M visits Nov 2025 (Semrush, via a third-party page); no US split | High. Public application form takes a feed, career page or ATS link; Jooble itself indexes other boards | Medium. Pay per click; "Premium Basic from $200, Advanced from $500" quoted on the page. Unclear whether unpaid organic listing exists. No duplicate or aggregator wording found | Low. Feed already built in its tag set | https://jooble.org/partner/ppc , spec https://jooble.org/files/xml_feed_specifications.pdf |
| 2 | **Talent.com** (formerly Neuvoo) | 30M+ jobs, 79 countries, 1,000+ sites served (self-reported); ~28M monthly visitors in 2022 (TechCrunch) | High. Crawls an XML URL or FTP; "all sizes of job boards" for its Job API; publisher program | Medium. A `cpc` field implies pay per click; no pricing, no aggregator or consent wording found; no public sign-up route ("contact us") | Low. Indeed-style feed already built | https://www.talent.com/integrations , https://employers.talent.com/publishers , https://techcrunch.com/2022/03/15/talent-com-raises-120m-to-take-on-indeed-and-ziprecruiter-in-mass-market-job-search |
| 3 | **Careerjet** | No total found | High. FAQ lets a website be submitted free for review, a feed is optional, "all types of feed" supported; indexes sites without a feed | Low to medium. Free to be indexed; advertiser ads cost $130 for 30 days a job, which we do not need. No spec, so feed layout unconfirmed | Low. Same Indeed-style feed | https://www.careerjet.com/contact-us , https://www.careerjet.com/partners/publishers |
| 4 | Adzuna | No reliable US figure | Medium. Says employers and platforms can send "an XML feed of all of the organic jobs on your platform", free. Does not say whether aggregators qualify. A job-board directory says it accepts only jobs posted directly on the board and charges pay per click with a $600 a month minimum (*second-hand*: https://www.haleymarketing.com/job-board-import-feed-specifications/) | Medium. Conflicting free versus paid claims | Low once their spec is read (403 to us) | https://www.adzuna.com/hire/products/job-listings/ , https://www.adzuna.com/jobs/xml-specification.html |
| 5 | Jobrapido | 55M monthly visits, 28M jobs, 100M+ registered users, 58 countries (self-reported, undated, on Workable's listing) | Medium. Third-party job boards submit feed URLs to it (Cavuno docs). Support article on feed submission exists but 403 | Unknown. Price pages say paid XML upload from £799 a month (*second-hand*, stale risk) | Low if Indeed-style is accepted; spec unread | https://support.jobrapido.com/hc/en-us/articles/360019196973-FEED-XML-how-can-I-send-my-feed-to-Jobrapido , https://cavuno.com/docs/xml-feeds , https://partners.workable.com/jobrapido |
| 6 | WhatJobs | Not found | Medium. Public publisher program; XML feed of all current jobs; only jobs under 28 days indexed (*snippets only*). Pay per click on sponsored jobs (*second-hand*) | Medium | Low; spec unreadable | https://www.whatjobs.com/xml-feed-specification , https://www.whatjobs.com/affiliates , https://jboard.io/blog/job-feeds |
| 7 | Google for Jobs | Largest by far | High, free, in progress by a sibling session (structured data on `/jobs/<id>`) | Medium. Page must hold one job; employer title unaltered; no posting "without authorization"; only the employer may supply base salary. Aggregators neither allowed nor banned in the text | Done elsewhere | https://developers.google.com/search/docs/appearance/structured-data/job-posting , Indexing API quota 200 a day: https://developers.google.com/search/apis/indexing-api/v3/quota-pricing |
| 8 | Bing | Small | Bing indexes our job pages through IndexNow (already running). No Bing job feed or JobPosting program found; its jobs box is reportedly LinkedIn-fed (unconfirmed) | Low | None | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a |
| 9 | NLx (National Labor Exchange) | 18,000+ employers; feeds every state job bank and "syndicated partners" | Low as an intake. It indexes employer career sites free; it does not index third-party sites. Our jobs may reach it at their source without us. The feed spec, signer and partner terms are not public (nlx@naswa.org) | Unknown | Unknown | https://www.naswa.org/national-labor-exchange/nlx-services-and-tools , https://naswa.org/national-labor-exchange/national-labor-exchange-state-services |
| 10 | ZipRecruiter | Not found | Low. The public feed spec (v1.9, Oct 2025) is for employers and ATS vendors posting to an account; the "Publisher Service Terms" cover sites that display ZipRecruiter jobs, the opposite direction. Duplicates are filtered | Medium. Account or subscription may be required (page 403) | Medium | https://www.ziprecruiter.com/assets/static/pdf/xml-feed-import.pdf , https://www.ziprecruiter.com/marketplace/publisher_service_terms , feeds@ziprecruiter.com |
| 11 | Handshake / Symplicity / 12Twenty (university career feeds) | Large student base but entry-level skewed | Low. Handshake's XML feed is for Enterprise-tier employers (*snippets*); Symplicity sells its own curated entry-level feed; no aggregator route found | Medium | High | https://support.joinhandshake.com/hc/en-us/articles/32407031672215-A-Guide-to-Handshake-XML-Job-Feed , https://www.symplicity.com/higher-ed/blog/career-services/introducing-symplicity-curated-job-feed |
| 12 | Built In | Not found | Low. Employer or ATS feed handed to a Built In representative; no public spec (*snippet*) | Medium | Medium | https://help.lever.co/hc/en-us/articles/20087371759261 |
| 13 | Ladders | Not found | Low. Only ATS integrations (Greenhouse, Ceipal), paid employers | Unknown | Direct contact only | https://support.greenhouse.io/hc/en-us/articles/360048241492-Ladders-integration |
| 14 | Recruit.net | Not found | Unknown. No spec, terms or sign-up page found | Unknown | Direct contact only | https://techcrunch.com/?p=6422 |
| 15 | DirectEmployers (.jobs) | Alliance of employer sites | Low. Member association for employers; no public submission spec | Unknown, probably a membership fee (unverified) | Direct contact only | https://www.uww.edu/Documents/adminaffairs/HR%20Diversity/DirectEmployers%20Job%20Alliances%20List__7_19_2017.pdf |
| 16 | Indeed | Largest | **Closed.** See above | n/a | n/a | https://docs.indeed.com/job-sync-xml/xml-feed |
| 17 | Glassdoor | Large | **Closed** (jobs come from Indeed, *second-hand*) | n/a | n/a | https://www.glassdoor.com/about |
| 18 | LinkedIn | Largest | **Closed.** Aggregated jobs must be excluded; only direct employer postings | n/a | n/a | https://learn.microsoft.com/en-us/linkedin/talent/job-postings/xml-feeds-development-guide |

## AI-native and open surfaces

| Surface | How jobs get in | Fit |
|---|---|---|
| ChatGPT | No OpenAI job-feed program confirmed (a Jan 2026 report says OpenAI is testing career tools: https://allwork.space/2026/01/openai-tests-chatgpt-career-tools-to-help-users-upskill-and-job-search ). Indeed, ZipRecruiter and Wizehire reach ChatGPT as apps (*second-hand*: https://www.pulse.bot/hrtech/news/indeed-rolls-out-chatgpt-app-to-uk-jobseekers-cf2f789a-3f5f-4dbe-899f-0678cdb3b7a6/) | The way in is our own app or MCP server. A sibling session is building the MCP server. |
| Job MCP directories | Community and vendor servers: Workopia (claims 6.3M jobs from career pages, a direct competitor), JobsWithGPT, TheirStack, Foundrole, Dice. https://theirstack.com/en/blog/best-jobs-mcp | Listing is the sibling session's task. |
| Perplexity, Jobright, Simplify, Wellfound | No ingestion program documented. Simplify appears to aggregate (*second-hand*); Wellfound is employer-posted | None found. |
| Himalayas, Remotive, Remote OK | These are sources to read, not partners to feed. Remotive's terms forbid sending its jobs to third parties (Jooble is named): https://github.com/remotive-com/remote-jobs-api | Not a fit; mostly remote tech. |

## What each partner asks of the feed (formats)

- **Indeed-style `<source><job>`** (Talent.com required fields: referencenumber, title, company, city, state, country, dateposted, url, description in CDATA, HTML, at least 50 characters; recommended expirationdate, jobtype, salary, cpc). Talent.com is said to refetch every 4 hours (*second-hand*: https://support.exacthire.com/talent.com-job-board-integration-qa). Careerjet and Adzuna are expected to read the same layout; neither publishes its layout.
- **Jooble**: `<jobs><job id>` with link, name, region, description, pubdate, updated (DD.MM.YYYY), plus salary, company, expire, jobtype when available. Crawled at least every 24 hours. Jobs more than 45 days old at first index are skipped. Must hold all current jobs and the description must match the linked page. Size and gzip limits not stated.
- **ZipRecruiter**: `<source><job>`, fetched 4 times a day with Basic auth; omitted jobs are removed; referencenumber up to 64 characters.

## Cost and signatures

| Partner | What registering costs | Who has to sign |
|---|---|---|
| Jooble | Application form is free. Promotion is pay per click (page quotes $200 / $500 plans). Whether a listing without spend gets traffic is not stated | Not documented. Presumably the owner, as company officer |
| Talent.com | No price published. `cpc` field suggests pay per click | Not documented; contact only |
| Careerjet | Free to be submitted for review | Not documented |
| Adzuna | Free per Adzuna's page; third parties say paid. Unconfirmed | Not documented |
| Others | Unknown | Unknown |

Every partner's terms of service must be read in full before agreeing: the public pages do not show them for Jooble, Talent.com, Careerjet or Adzuna. That is the owner's decision.

## Honest limits

1. Whether any of these partners will accept a feed whose jobs we did not post is **not answered by public documents**. The only way to know is to ask. Careerjet and Jooble are the likeliest yes.
2. No partner's page was found saying employer consent is required for jobs taken from an employer's career site. That is silence, not permission. The jobs are public postings with the employer's own apply link, and the feed sends applicants to the employer, not to us.
3. The feed ships the employer's apply link, never ours, so we do not collect applicants. The traffic that comes back to NextChapter from a partner is therefore only what the partner sends on click, and in the "direct" variant that goes to the employer. A variant that links to `/jobs/<id>` on our site exists in the code but several partners require the link to show the full job (Jooble: the description must match the linked page).
4. A previous version of these feeds shipped and was removed on 2026-10-26 in PR #422 (https://github.com/justinkulla81/nextchapter/pull/422) without a reason in the PR text. If the removal was deliberate, check why before turning these back on.

## Recommendation: first three

1. **Jooble.** Open application form, documented spec, a tag set we already generate, and Jooble crawls other boards itself. Ask what an unpaid listing gets before paying anything.
2. **Talent.com.** Documented spec, publisher program for "all sizes of job boards", crawls a URL, the required fields match what we hold.
3. **Careerjet.** The only one that publicly says a site can be submitted for free review and that a feed is optional. Same Indeed-style feed.

Adzuna is fourth: read its spec first (403 to us).

## What was built

Feed endpoints for the top three, from stored tables and a daily cron (no live query per request):

- `https://launchyournextchapter.com/feeds/jobs-direct.xml.gz`: Indeed-style layout for Talent.com and Careerjet (and Adzuna once confirmed). Only jobs listed on the employer's own career system, each `<url>` the employer's apply link.
- `https://launchyournextchapter.com/feeds/jobs-jooble.xml.gz`: Jooble's tag set, posted within the last 45 days.

Rules in the builder: the public-page allowlist (approved, open, US, professional, no internships, verified live in the last 7 days, not a known ghost job); hourly pay excluded; pay only when the source gave it; direct listings with a working http(s) apply link only; companies on the opt-out list left out (`src/lib/syndication/feed-optout.ts`; no opt-out table exists in the database, so it is a code list plus an environment variable).

### Tested so far

- The feed query was run read-only against live data for one of 16 shards: 9,224 jobs qualify (about 148,000 across all shards), 0 with a non-http apply link, 0 hourly, 1,617 with stated pay, 5,914 posted within Jooble's 45-day window.
- Live rows carry yearly-sized pay labelled "day" (for example $69,800–$119,020 a "day"). The feed sends pay only when the period is "year".
- The XML builders, opt-out matching and download rate limit have unit tests (`src/test/job-feed-xml.test.ts`). A scoped typecheck of the changed files passes.
- **Not yet done:** the two feed files do not exist until the daily crons run once after deploy (`/api/cron/job-feed-direct` 12:15 UTC, `/api/cron/job-feed-jooble` 12:30 UTC); until then each URL answers 503 "being built". The end-to-end download has to be checked after the first run.
