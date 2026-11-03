# Pay data (`/resources/pay-data`)

Built 2026-11-03. Public pages, a CSV for each table and structured data (Dataset and FAQPage) on every page, so search engines and AI assistants can cite the numbers.

## Pages

| Address | What it shows |
| --- | --- |
| `/resources/pay-data` | Overview: pay by level, top industries and functions, top skills |
| `/resources/pay-data/industry`, `/industry/<slug>` | Pay by industry; each industry's pay by level |
| `/resources/pay-data/function`, `/function/<slug>` | Pay by function; each function's pay by level and highest-paying skills |
| `/resources/pay-data/size` | Pay by employer headcount band |
| `/resources/pay-data/hiring` | Pay by jobs open now; hiring growth status |
| `/resources/pay-data/skills`, `/skills/<slug>` | Skills ranked by pay and by gap; one page per skill |
| `/resources/pay-data/data.csv`, `/skills.csv` | The tables, aggregates only |
| `/resources/pay-data/sitemap.xml` | Listed in the sitemap index |

Linked from `/salaries`, each `/salaries/<title>` page, `/functions/<function>`, `/industries/<industry>` (17 of 27 have a matching crawler industry), `/top-employers`, `/ai-skills`, `/resources/ai-skills-pay-premium` and `/data`; in `llms.txt`; owned phrases in `src/lib/seo/keywords.ts`.

## Method

- **Postings counted:** live (not archived, approved, not expired, not an internship) with employer-posted pay (`paySource` posted or text), annualized from the posted period (hour x 2080, day x 260, week x 52, month x 12), annual equivalent between $20,000 and $1,500,000. A posting's pay is the midpoint of its range. Same definition as the AI pay premium (`src/lib/skills/ai-market-live.ts`).
- **Groups** (industry, function, level, size, hiring volume) publish with 30+ postings from 8+ employers.
- **Like-for-like gap:** inside cells of the same function, level and industry (industry itself: function and level), compare the group with every other posting that has the dimension; weighted by the group's postings; cells need 15+ on each side. Published with 150+ postings across 5+ cells, otherwise "n/a".
- **Skills** publish with 100+ postings from 15+ employers and no single employer above 25% of them (one employer listing "Asana" on hundreds of roles read as +51% in the 2026-11-03 probe). "Without the skill" means postings that list other skills (postings with no extracted skills are in neither group). Overall salary = median of postings listing the skill.
- **Employer size:** `CompanySizeLookup` (curated list, or the model's estimate at 50%+ confidence) else `Company.sizeBand`. The 2026-11-03 backfill classified the paid employers with 3+ paid postings (about 3,900) with the same prompt and model as `src/lib/market/company-size.ts`. Sizes can be off by one band; the page says so.
- **Hiring growth:** not published. `CompanyHiringProfile.opened90d / opened12mo` cannot measure growth (the crawl is only months old, so nearly every employer reads as growing). The cron stores one openings snapshot a month (`BoardFigure` key `pay-data-snapshot:YYYY-MM`); the hiring page adds growth when 4 months are stored.

## Where it runs

`src/lib/pay-data/compute.ts` (one temp table, one transaction, about 45 seconds) writes the `pay-data` board figure from the `pay-data` cron, a job in `bundle-market-data` (08:20 UTC daily). Pages read the stored row; none scans the board. Pure assembly and the publish bars are in `assemble.ts` (`src/test/pay-data.test.ts`).
