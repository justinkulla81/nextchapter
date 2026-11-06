Goal: add crawler adapters in this repo (`nextchapter-jobs`, ncrawl) for three employers that run their own career sites, so their US jobs come in as direct listings (`directListing` true, `sourceCategory` 'employer') instead of through Jooble. Dry run first; do NOT import into production until the owner approves the counts.

Context
- The board holds live US jobs whose apply link is jooble.org. Google is offered only direct employer-system jobs, so Jooble-linked jobs are not indexed. Goldman Sachs (65 live via Jooble, 0 direct), TikTok (73, 0) and ADP (151 across two company names, 0) have no direct rows yet.
- Rule: use the employer's career site and job system, never its corporate site. Public endpoints only, identified user agent `NextChapterResearch/1.0 (research@launchyournextchapter.com)`, polite rate (no parallel hammering).
- US jobs only (keep the existing US screen; do not bring in other countries).
- Jobs reports cover all white-collar jobs at every level, entry-level included. Do not change the seniority screen in this task; report what it drops, by level, per employer.
- The import now collapses a third-party copy into a live direct row when the crawler sends the Jooble row with `duplicateOf` set to the direct row's URL (`direct_match.py`, already built). The direct row must be on the board, open, verified within 14 days, and direct. New sources must keep `lastVerifiedAt` fresh through the normal crawl and liveness re-check.

The three sources (all verified reachable 2026-11-06)
1. Goldman Sachs: `POST https://api-higher.gs.com/gateway/api/v1/graphql`, headers `Origin: https://higher.gs.com`, `Content-Type: application/json`. Operation `GetRoles`, variables `{"searchQueryInput":{"page":{"pageSize":N,"pageNumber":P},"sort":{"sortStrategy":"RELEVANCE","sortOrder":"DESC"},"filters":[],"experiences":["PROFESSIONAL","EARLY_CAREER"],"searchTerm":""}}`, query `query GetRoles($searchQueryInput: RoleSearchQueryInput!) { roleSearch(searchQueryInput: $searchQueryInput) { totalCount items { roleId jobTitle locations { city state country } } } }`. 698 roles, all countries. My guessed location filter was rejected (`categoryFilter` is not a field of `SearchFilterInput`); introspect the schema or filter by `locations.country` client-side. Find the full-description and apply-URL fields (the job page is on higher.gs.com; confirm the URL pattern from `roleId`). Note `experiences` may exclude some levels: check which values exist and do not drop entry-level.
2. TikTok: `POST https://api.lifeattiktok.com/api/v1/public/supplier/search/job/posts`, headers `Origin: https://lifeattiktok.com`, `Referer: https://lifeattiktok.com/`, `website-path: tiktok`. Body `{"keyword":"","limit":100,"offset":0,"job_category_id_list":[],"location_code_list":[],"subject_id_list":[],"recruitment_id_list":[],"portal_type":6,"job_function_id_list":[],"storefront_id_list":[],"portal_entrance":1}`. Response `data.job_post_list` and `data.count` (4,291, all countries; about a third US in a one-page sample). Each post has `id`, `code`, `title`, `description` and `city_info` (with a `parent` chain up to the country). Page with `offset`. Find the job detail URL on lifeattiktok.com and any posted/updated date.
3. ADP: server-rendered site `https://jobs.adp.com/en/jobs/?page=N` (about 47 pages; links `/en/jobs/<id>/<slug>/`). Detail pages carry JobPosting data (`addressRegion` present; no `validThrough` seen). Applying goes through myjobs.adp.com. Two company names exist on the board ("ADP" and "ADP - Automatic Data Processing"): alias them to one employer.

Not in scope: Jacobs (Avature, blocked by a bot challenge: every request answers an empty HTTP 202). Do not try to evade it. Report if a documented public feed exists.

Do this
1. Find how ncrawl defines a source adapter (look at an existing non-Workday adapter, how `direct_listing` and `sourceCategory` are set, how location, level, pay and description get parsed). Add three adapters the same way. Say which files you changed or would change.
2. Dry-run each (no upload). Per employer report the funnel: listed, fetched (list and detail), non-US dropped, dropped by seniority/title screen (by level), rank floor, posted-date window, duplicates, kept. List 10 titles dropped at entry or early level.
3. Compare kept US jobs with "live via Jooble" and "live direct now". Run `direct_match.py` on the three to report how many Jooble rows would collapse, how many are blocked and why.
4. Confirm the new sources are in the liveness re-check and keep `lastVerifiedAt` fresh.

Report back
A funnel table per employer, files changed, match results and a recommendation. Mark anything you could not measure. Do not import to production, and do not guess numbers.
