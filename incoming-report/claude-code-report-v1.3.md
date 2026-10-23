# Claude Code prompt: publish report version 1.3

## How to run this in the Claude desktop app (no Terminal)

1. Open the **Claude** desktop app on your Mac.
2. In the left sidebar, click **Code** (Claude Code).
3. Start a new session. When it asks which folder to work in, pick the **nextchapter** folder in your home folder (the same folder that has `incoming-report` inside it).
4. If it asks where to run, choose your computer (**Local**), not the cloud, so it can see your files.
5. In the message box, paste this one line and press Enter:

   `Read incoming-report/claude-code-report-v1.3.md and do it.`

6. Claude will ask permission before it edits files or runs commands. Read each request and click **Allow** when it matches what this file says. It will stop and show you screenshots and changes before it deploys anything.
7. When you're happy with the screenshots, type `deploy` and press Enter.

You only need this one file. It includes the earlier version 1.1 (email capture) and 1.2 steps, so you don't need to run those separately. If they're already done, Claude will notice and skip them.

---

You are publishing version 1.3 of the NextChapter Displacement Report (September 2026). Read `CLAUDE.md`, `AGENTS.md` and `design-principles.md` first. Show me the diff and screenshots before deploying.

## 0. Earlier steps (skip any that are already done)

- If the newsletter pop-up, the site-footer newsletter box and the PDF email gate don't exist yet, do everything in `incoming-report/claude-code-report-v1.1-and-email-capture.md` first.
- If the report page doesn't yet have the Q3 addendum, do the steps in `incoming-report/claude-code-report-v1.2.md` (the file paths and checks there still apply). Then continue below.

## 1. Replace the edition page with version 1.3

- **Port the source.** The source is `incoming-report/displacement-report-september-2026.html` (version 1.3). Port it into `src/app/reports/displacement-report-september-2026` the same way as before:
  - server-rendered text
  - scoped CSS, including the `table.txt` rule and the print rule for wrapping table headers
  - chart script via `next/script`
- **Keep what's already there:**
  - the newsletter signup component in place of `#newsletter-slot`
  - the pop-up
  - the PDF email gate, with its "Media or researcher? Download directly" link
- **What changed in 1.3**, for your summary to me:
  - corrected Greenhouse figures
  - "significant" relabeled as "beyond 90% MOE" with an explanation
  - two reworded sentences
  - clearer table notes
  - Exhibit 9 print fix
  - version log row 1.3
- **Replace or add these files in `public/reports/`:**
  - `displacement-report-2026-09.pdf` (version 1.3, 57 pages)
  - `displacement-report-2026-09-data.csv` (index values corrected to 161.6 and 128.2)
  - `displacement-report-2026-09-og.png` (new share image: "21% vs 9%" and the index's new name)
  - `nextchapter-carousel-2026-09.pdf`: optional, for anyone who wants the slides
  - `sec-item205-ai-coding-2026.csv` and `displacement-report-2026-q3-revenue-per-employee.csv`, if not already there
  - Keep `wc-index.csv`.

## 2. Metadata

- **Dates:** set `dateModified` (JSON-LD) and `article:modified_time` to 2026-10-06. The JSON-LD `version` should be "1.3".
- **Description:** the meta description should use "White-Collar Long-Term Unemployment Index".
- **Correction note:** keep a visible "Corrected October 6, 2026" note near the top that links to the correction box in Chapter 03.
- **Share image cache-busting:** make sure `og:image` points to the new PNG, and add a version query, for example `/reports/displacement-report-2026-09-og.png?v=1.3`, so LinkedIn and X fetch the new image instead of a cached one.

## 3. News item

If you haven't already, add a news item with `scripts/displacement/add-news-item.ts`: "Correction and Q3 addendum: NextChapter Displacement Report v1.3", linking to the report.

## 4. Checks

1. Run `npm run build` and `npm run lint`.
2. Run Lighthouse on the report page; SEO and Accessibility must not drop.
3. Take screenshots on desktop and at phone width of:
   - the cover
   - Exhibit 9
   - the Q3 addendum tables (they must scroll sideways inside their box, not the whole page)
   - the newsletter pop-up
   - the PDF gate
4. Wait for me to type "deploy".
5. After deploying:
   - Run the IndexNow script for the report URL.
   - Tell me to:
     1. Refresh the link preview in LinkedIn's Post Inspector (https://www.linkedin.com/post-inspector/): paste the report URL and click Inspect.
     2. Request re-indexing in Google Search Console.
