# Large US-listed employers: where direct listings are missing or undercounted (2026-11-12)

Source: stockanalysis.com "most employees" ranking, filtered to US-listed companies (1,720 with at least 1,300 employees). For each company, counts on the
board by name: live direct (verified in the last 14 days, not from an aggregator, search firm, venture or association board), board copies, and stale direct
rows (direct rows hidden because the crawler has not re-verified them in 14 days or more). One bounded read of `BoardLightRow` plus a join on posting ids per batch.
Matching is by normalized name, so a company stored under another name shows as zero.

Coverage: the first ~450 by headcount, a further ~380 of the next 450, and 326 of the last 777 (ranks below about 1,300 employees were only partly checked).

## 1. Zero live direct jobs, only board copies (never or not yet crawled)
Maximus 595, CVS Health 441, Accenture 173, Omnicom 142, Goldman Sachs 106 (adapter not in production), Aramark 90, Thermo Fisher 90, KinderCare 81, Cushman & Wakefield 77,
ADP 67, GE Aerospace 65, Charles Schwab 65, Qualcomm 57, Healthcare Services Group 57, Global Payments 56, M&T 52, Fiserv 49, CBRE 45, Flex 43, CRH 43, Corning 41, Addus 41,
GM 37, Prudential 33, Iron Mountain 32, Amentum 31, PG&E 28, Huntington Ingalls 26, Urban Outfitters 26, Tesla 25, Gap 25, SAIC 25, Seagate 24, BrightSpring 23, Victoria's Secret 23,
Keurig Dr Pepper 22, TE Connectivity 22, Textron 21, IBM 20, Advantage Solutions 17, Energy Transfer 17, MetLife 16, American Airlines 15, McDonald's 14, Emerson 14, Teva 13,
Parker Hannifin 13, Ingram Micro 13, Cleveland-Cliffs 12, Rockwell 12, Tetra Tech 11, BJ's 11, U.S. Bancorp 11, Chevron 11, P&G 10, Jacobs 10, Robert Half 474, Regeneron 80, Korn Ferry 52,
Equinix 35, Netflix 26, EchoStar 26, Domino's 24, AES 23, Envista 23, Lennox 18, Newmark 17, Fox 16, Agilent 16, Marathon Petroleum 15, Clorox 15, Globe Life 152, Snap 55, Jazz 32, Nelnet 30,
Warby Parker 29, Paylocity 29, Kelly Services 28, F5 26, Church & Dwight 22, T. Rowe Price 20, Lamar 20, Teradata 20, Brady 19, Omnicell 17, Workiva 17, KKR 14, Check Point 14, and about
135 smaller companies with no copies at all or fewer than 10 (counts above are board copies).

## 2. Far too few live direct jobs (stale direct rows in brackets)
Salesforce 1 (430), Boeing 1 (490), Comcast 1 (220), Disney 1 (195), Citigroup 2 (236), Allstate 2 (160), GE Vernova 2 (509), FedEx 2 (168), State Street 3 (390), Home Depot 3 (288),
Coca-Cola 3 (106), Visa 3 (193), Morgan Stanley 4 (692), Johnson Controls 4 (486), J&J 5 (419), Mastercard 5 (193), Target 6 (358), Broadcom 6 (154), Tenet 6 (237), Jabil 7 (438),
Centene 8, Cigna 8 (93), Micron 8 (636), Cardinal 9, AT&T 9 (273), Merck 10 (295), EMCOR 11 (482), Intel 13, Microsoft 14 (1,243), Bristol Myers Squibb 14 (278), Caterpillar 15 (449),
Applied Materials 36 (544), Kraft Heinz 37 (269), GlobalFoundries 2 (201), Moderna 1 (157), Sinclair 0 (318).
Most of these have hundreds of stale direct rows: the fix is the crawler re-verifying rows it already holds, not finding new sources.

## Next
Sources already written today: `scripts/jobsreport/sources/jooble-tier5.json`, `jooble-tier6.json`, `jooble-tier6b.json`, `stocks-*.json`, `unicorns-us.json`.
Companies in section 1 without a source go into the crawler prompt (`docs/specs/ncrawl-tier5-unicorns-prompt.md`).
