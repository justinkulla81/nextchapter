# Monthly report routine

What happens after each edition of the NextChapter White Collar Employment
Report is published (within two business days of the BLS jobs report, usually
the first Friday). The report is the public research; everything below is
distribution and internal use made from it.

## What is part of the report, and what is not

| Piece | Part of the report? |
|---|---|
| Report page, full PDF, brief, data CSV, OG image, replication repo | Yes |
| Early-warning section (U.S. graduates and early-career vs senior, canary test, job cuts citing AI by country, peer economies) | Yes, in every edition from October 2026 |
| Chart post, LinkedIn carousel, LinkedIn posts, news item, mailing edition | Companions made from each edition |
| Pitch slides, "longer search" message, Pivot Path trend data, search-plan evidence lines | Quote the report's figures; refreshed each month |
| Business-actions email | Internal; reads each edition |

## Checklist after a new edition is published

1. **Rebuild the replication data** (replication repo `code/`), so
   `data/exposure_test_results.json` and the occupation file are current.
2. **Refresh the early-warning data** (every edition from October 2026):
   `npm run report:early-warning -- --edition <YYYY-MM>`
   It writes a snapshot to `public/reports/early-warning/<YYYY-MM>/` (U.S. CPS series, peer
   countries from OECD/IMF/Eurostat/Census, job cuts citing AI by country) and copies the files
   to `public/reports/` as the latest downloads. Read the output: the unresolved-employer count,
   and any new employers needing a country or a canonical name in `data/employer-countries.csv`
   (rows marked `manual` are never overwritten). Then add
   `<EarlyWarningPanels edition="<YYYY-MM>" />` (from `@/components/reports/EarlyWarningPanels`)
   to the edition page; `src/test/report-early-warning.test.ts` fails if an edition from
   October 2026 on has no snapshot or does not render the section. The U.S. series needs the
   edition month's CPS file, published a few weeks after the month ends; if it is not out yet,
   the series stops at the last month available, and the tables are labelled with that month.
3. **Refresh the trend data** the Pivot Path panel reads:
   `npm run report:refresh-trends -- --edition "<Month Year>" --version <x.y> --csr-margin <thousands from the report>`
   Review the diff, run the tests.
4. **Check every stored figure** against the new PDF:
   `npm run report:check-facts -- public/reports/white-collar-employment-report-<YYYY>-<MM>.pdf`
   Fix anything it lists as MISSING in `src/lib/pitch/report-facts.ts`
   and `src/lib/marketing/longer-search-message.ts`. Update `REPORT_EDITION`
   and the edition text in both files. Also check the evidence lines in
   `src/lib/journey/search-playbook.ts` and `src/lib/jobs/search-efficiency.ts`
   by hand; they quote the same exhibits.
5. **Chart post:** `npm run report:chart-post -- --list`, then render one.
   See `monthly-chart-post.md`.
6. **Carousel:** copy `scripts/employment-report/carousel-2026-09.html` to the new
   month, change the figures and sources, build with
   `node scripts/employment-report/nc_build_carousel.js <html> <pdf>`, and look at
   every page.
7. **LinkedIn posts, news item:** `npm run report:news`, then the posts file.
8. **Pitch rules:** if a saved override exists for a pitch type, reset the
   slide to default so the new figures show (overrides keep old text).
9. **Business actions:** the scheduled task `nextchapter-report-to-business`
   emails the actions and prepares a refresh branch (steps 2 to 4) without
   pushing it.

Everything with a number in it is copied from a named exhibit; never derive a
figure in code.
