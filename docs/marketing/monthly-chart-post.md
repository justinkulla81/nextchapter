# Monthly chart post

One chart from each White Collar Employment Report edition, rendered as a post image.
No network, no database, no LLM; it reads the CSVs already in `public/reports/`.

## Routine (about 15 minutes, once per edition)

1. **Refresh the data.** After the edition publishes and `npm run report:index` has updated `public/reports/wc-index.csv`, copy the replication repository's current `data/hires_per_opening.csv` to `public/reports/hires-per-opening.csv`. The industry file (`industry-productivity-vs-long-searches.csv`) is an annual third-quarter feature.
2. **Register the edition.** Add it to `REPORT_EDITIONS` in `src/lib/reports.ts` (the script reads the month label from there).
3. **Pick the chart.** Choose the one chart in the edition that is surprising and easy to say in a sentence. List what is available:

   ```bash
   npm run report:chart-post -- --list
   ```

4. **Render it.**

   ```bash
   npm run report:chart-post -- --edition 2026-10 --chart wc-index
   ```

   This writes `public/reports/chart-post-<edition>-<chart>-1200x1350.png` (feed post) and `...-1200x630.png` (link card). Options: `--size portrait|landscape|both`, `--out <dir>`, `--svg`, `--data-dir <dir>`.
5. **Check it by eye.** Title says what the chart shows, the source line names the period, the margin-of-error note is present where a survey estimate is shown, and the footer reads "NextChapter White Collar Employment Report <Month Year>" with launchyournextchapter.com/reports.
6. **Post it** the week of the jobs report, with one sentence of text and the link to the edition page.

## Rules for the text

- Say what the data shows. Never say AI caused it; the report says it cannot establish that.
- Keep the period on every number (January to August averages are not the same as a seasonally adjusted month).
- Do not compare month to month unless the change exceeds the 90% margin of error.
- Approved message blocks and their figures live in `src/lib/marketing/longer-search-message.ts`.

## Adding a chart

Add a `ChartDef` to `scripts/reports/monthly-chart-post.ts` with an `id`, a `build()` that returns `title`, `subtitle`, `source`, an optional `moeNote`, and a `draw()` that returns SVG. Add `compact` footer text if the landscape card is tight. List it in `--list` by adding it to `CHARTS`.

The September 2026 example (productivity versus long searches) is `public/reports/chart-post-2026-09-productivity-vs-long-searches-1200x1350.png` and `...-1200x630.png`.
