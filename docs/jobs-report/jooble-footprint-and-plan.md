# Jooble's footprint, why the target employers are low, and how to minimize Jooble (2026-11-12)

## 1. Jooble's footprint (live US rows, verified in the last 14 days; one query, 2026-11-12)

About 94,800 live US jobs link through Jooble, spread over about 40,300 employers:

| Employers | Count | Jooble rows | Share |
|---|---|---|---|
| Already have direct rows | 3,056 | 13,451 | 14% |
| No direct rows, staffing or recruiter-like name (name heuristic) | 7,472 | 22,844 | 24% |
| No direct rows, other employers | 29,819 | 58,526 | 62% |

The tail is long: the 29,819 "other" employers average about 2 Jooble rows each, and only 161 of them have 20 or more (6,329 rows in all). Employers with 20 or more rows hold about 19,300 of the 94,800 rows. So finding career sites employer by employer can reach roughly a fifth of Jooble. Removing it needs a different method (section 3).

## 2. Why the target employers show so few direct jobs

Production (live direct, hidden-stale direct, newest verification) against the public board (Workday jobs endpoint, 2026-11-12). Earlier "zero" claims were partly wrong because direct rows sit under other company names: M&T is "Manufacturers and Traders Trust Company" (373 live), AIG is "American International Group" (135 live), Boeing is "The Boeing Company" (1 live, 468 rows), Flextronics is "Flex" (178 rows, 0 live).

| Employer | Board (US where counted) | Live direct | Hidden (stale 14+ days) | Newest verified | Pattern |
|---|---|---|---|---|---|
| Accenture | 2,000+ | 0 | 521 | Oct 15 | not crawled since the crash |
| Verizon | 1,294 | 0 | 226 | Oct 18 | not crawled |
| General Motors | 686 (586 US) | 0 | 512 | Oct 22 | not crawled |
| Wolters Kluwer | 470 | 0 | 129 | Oct 19 | not crawled |
| Boeing | 840 | 1 | 467 | Oct 31 | not crawled |
| Flex | 851 (218 US) | 0 | 178 rows | Oct 16 | not crawled |
| Morgan Stanley | 1,206 (857 US) | 4 | 609 | Nov 8 | crawled, few jobs re-verified |
| Salesforce | 1,576 (569 US) | 1 | 362 | Nov 7 | crawled, few re-verified |
| State Street | 1,191 (543 US) | 3 | 360 | Oct 31 | crawled, few re-verified |
| Capital One | 2,067 | 77 | 608 | Nov 11 | partial crawls |
| Booz Allen | 2,000+ | 80 | 530 | Nov 9 | partial crawls |
| Nvidia | 2,000+ | 99 | 369 | Nov 11 | partial crawls |
| Johnson Controls | 2,806 | 4 | 394 | Nov 3 | partial crawls |
| Palo Alto Networks | 1,339 | 36 | 258 | Nov 3 | partial crawls |
| Micron | 2,902 | 2 | 357 | Nov 10 | rows come from micron.eightfold.ai, not the Workday board: source mismatch |
| JLL | 2,000+ | 3 | 0 | Oct 31 | only 3 rows ever: source config |
| Goldman Sachs, TikTok | 900 / 4,307 | 0 | 0 | none | adapters written, not yet in production |

Three patterns: (1) boards not crawled since mid-October (the Workday crash); (2) boards crawled, but a time-capped partial crawl re-verifies only a slice each run, so most rows age out of the 14-day window; (3) source configuration (Micron, JLL) or a source not yet added (Flex name, Goldman, TikTok). Patterns 1 and 2 should clear when the first fixed daily sync finishes and imports; it was due around Nov 10 and had not landed by Nov 12.

## 3. How to remove or minimize Jooble

1. **Match, then collapse (14% of rows, 3,056 employers).** These employers already have direct rows. Collapse each Jooble copy into its direct row (the matcher, already built) and finish their crawls (section 2).
2. **Convert the 280 employers with 20 or more rows (about 19,000 rows).** Boards found so far: 33 + 25. Continue down the list.
3. **Cover the long tail by platform, not by employer.** Small employers use a handful of public job systems (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, BambooHR, Teamtailor, Paylocity and similar). Enumerate every employer on each platform (the Common Crawl prompt in `docs/specs/ncrawl-enumerate-ats-prompt.md`), ingest all their jobs, then match Jooble employers to platform employers by name and web address. Measure: share of Jooble employers that gain a direct source.
4. **Staffing and recruiter rows (24%).** The posting is the recruiter's own listing; there is no copy on a client's career site. Decide: keep on the member board below direct jobs, or drop.
5. **Quality gate on what remains.** Never indexed (already). Rank direct above Jooble in member search; hide Jooble rows by default for employers that have a direct source; drop rows with a hidden employer ("Confidential"), junk boards and duplicates; cap Jooble ingestion to employers with no direct source.

Realistic result: steps 1 to 3 plus the quality gate reduce Jooble's live rows by roughly half or more; staffing and the unmatched tail are what remains unless the owner drops them.
