# Claude Code prompt: publish report version 1.4 and the replication materials

## How to run this in the Claude desktop app

1. Open the **Claude** app on your Mac.
2. In the left sidebar, click **Code**.
3. Start a new session and choose your **nextchapter** folder. If it asks where to run, choose your computer (**Local**).
4. Paste this line and press Enter:

   `Read incoming-report/claude-code-report-v1.4.md and do it.`

5. When Claude asks permission to edit files, run commands or create the GitHub repository, click **Allow** if it matches this file.
6. **If Claude says GitHub isn't signed in:** it will show you a short code and a web address. Open the address, paste the code, click **Authorize**, and come back.
7. Look at the screenshots, then type `deploy`.

This one file covers everything: the earlier email-capture, 1.2 and 1.3 steps (it skips any that are done), the 1.4 report, the public GitHub repository and the replication page.

---

You are publishing version 1.4 of the NextChapter Displacement Report (September 2026) and its replication materials. Read `CLAUDE.md`, `AGENTS.md` and `design-principles.md` first. Show me diffs and screenshots before deploying.

## 0. Earlier steps (skip any already done)

- If the newsletter pop-up, site-footer newsletter box and PDF email gate don't exist, do `incoming-report/claude-code-report-v1.1-and-email-capture.md` first.
- If the report page lacks the Q3 addendum or the v1.3 fixes, `incoming-report/claude-code-report-v1.3.md` describes them. The new page source below already includes all of them.

## 1. Public GitHub repository

1. Check that the GitHub CLI is signed in (`gh auth status`). If not, run `gh auth login --web` and walk me through it.
2. Unzip `incoming-report/nextchapter-displacement-report-replication.zip` into a new folder outside the website repo: `~/nextchapter-displacement-report`.
3. In that folder:
   - Run `git init`.
   - Add a `.gitignore` covering `__pycache__/`, `*.pyc`, `x13_run*` and `.env`.
   - Make sure no file contains an API key: search for `CENSUS_API_KEY=` followed by a value, and stop if you find one.
   - Commit with the message "Replication materials for NextChapter Displacement Report v1.4".
4. Create a **public** repository named `nextchapter-displacement-report` under my GitHub account, with description "Code, parameters and derived data for the NextChapter Displacement Report (white-collar labor market)". Push it. Show me the URL.
5. Add GitHub topics: `labor-market`, `unemployment`, `current-population-survey`, `ai`, `economics`, `open-data`.

## 2. Replication page on the site

1. Create `src/app/reports/replication/page.tsx`: a short, server-rendered page titled "Displacement Report: replication materials", using the site's normal public-page layout. It should:
   - Explain in two sentences what the materials are.
   - Link prominently to the GitHub repository.
   - List what can be reproduced, using the table in the repo's README.
   - Link to the report and the methodology appendix (`/reports/displacement-report-september-2026#method`).
   - Give the corrections email jkulla@launchyournextchapter.com.
   - Have a meta description and canonical URL `https://launchyournextchapter.com/reports/replication`.
2. Add the page to the sitemap. Also add the repository URL to the report's Dataset JSON-LD as `isBasedOn`/`codeRepository` (`SoftwareSourceCode`).

## 3. Replace the edition page with version 1.4

1. **Port the source.** The source is `incoming-report/displacement-report-september-2026.html` (version 1.4). Port it into `src/app/reports/displacement-report-september-2026` as before:
   - server-rendered text
   - scoped CSS, including the new `.lbl`, `.lbl-row`, `.src` and `table.txt` rules
   - chart script via `next/script`
2. **Keep** the newsletter signup in place of `#newsletter-slot`, the pop-up and the PDF email gate (with its "Media or researcher? Download directly" link).
3. **New in 1.4:**
   - margins of error computed with the BLS method
   - Exhibit 3 (seasonal-adjustment robustness) and Exhibit 4 (job-losers companion measure)
   - an evidence-hierarchy box
   - "What we measure / What others find / What this may mean" labels
   - source links on the headline figures
   - an expanded Appendix B with a link to the replication page
   - version log 1.4
4. **Replace or add these files in `public/reports/`:**
   - `displacement-report-2026-09.pdf` (version 1.4 full report, 40 pages)
   - `displacement-report-2026-09-brief.pdf` (new: the 12-page monthly brief)
   - `displacement-report-2026-09-data.csv`
   - `nextchapter-carousel-2026-09.pdf`
   - `displacement-report-2026-09-og.png`, if not already replaced in 1.3
   - the two Q3 CSVs, if missing
5. **Two PDFs on the page.** The cover now has "Full report (PDF, 40 pages)" (`#pdf-btn`) and "Brief (PDF, 12 pages)" (`#brief-btn`). Set up downloads like this:
   - **Brief:** free, no email gate. It's the version people share.
   - **Full report:** behind the existing email gate. Keep the "Media or researcher? Download directly" link, which downloads the full report without the gate.
   - **Analytics:** add a PostHog event `report_brief_downloaded`.
6. **Metadata:**
   - JSON-LD `version` "1.4"; `dateModified` and `article:modified_time` 2026-10-06.
   - Keep the "Corrected October 6, 2026" note near the top.
   - Keep `og:image` with `?v=1.4` appended.
   - Add both PDFs to the Dataset JSON-LD `distribution`.
   - The cover line now reads "Reference period: September 1–30, 2026".

## 4. News item

Add or update the news item (`scripts/displacement/add-news-item.ts`): "Displacement Report v1.4: open code, BLS-method margins of error, corrections". Link it to the report.

## 5. Checks

1. Run `npm run build` and `npm run lint`. Run Lighthouse on the report and replication pages; SEO and Accessibility must not drop.
2. Take screenshots on desktop and phone of:
   - the cover
   - the evidence-hierarchy box
   - Exhibits 3 and 4
   - the Q3 addendum tables
   - the replication page
   - the pop-up and the PDF gate
3. Confirm the repository is public and its README renders.
4. Wait for me to type "deploy".
5. After deploying:
   - Run the IndexNow script for the report URL and the replication URL.
   - Tell me to:
     1. Refresh the link preview at https://www.linkedin.com/post-inspector/ (paste the report URL, click Inspect).
     2. Request re-indexing of both pages in Google Search Console.
