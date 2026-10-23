# Claude Code prompt: publish report version 1.71 (includes everything from 1.4 through 1.7)

## How to run this in the Claude desktop app

1. Open the **Claude** app on your Mac.
2. In the left sidebar, click **Code**.
3. Start a new session and choose your **nextchapter** folder. If it asks where to run, choose your computer (**Local**).
4. Paste this line and press Enter:

   `Read incoming-report/claude-code-report-v1.71.md and do it.`

5. When Claude asks permission to edit files, run commands or create the GitHub repository, click **Allow** if it matches this file.
6. **If Claude says GitHub isn't signed in:** it will show you a short code and a web address. Open the address, paste the code, click **Authorize**, and come back.
7. Look at the screenshots, then type `deploy`.

**This is the only file you need.** It replaces the 1.4, 1.5, 1.6 and 1.7 files. If you already ran one of them, Claude will skip the steps that are done. If you didn't, it does them all.

---

You are publishing version 1.71 of the NextChapter Displacement Report (September 2026), its replication materials and everything from earlier versions. Read `CLAUDE.md`, `AGENTS.md` and `design-principles.md` first. Check what already exists before each step and skip anything already done. Show me diffs and screenshots before deploying.

## 0. Earlier steps (skip any already done)

- If the newsletter pop-up, the site-footer newsletter box and the PDF email gate don't exist, do `incoming-report/claude-code-report-v1.1-and-email-capture.md` first.
- The new page source below already includes all the 1.2, 1.3 and 1.4 content. You don't need the older prompt files for the page itself.

## 1. Public GitHub repository

**If `nextchapter-displacement-report` doesn't exist yet on my GitHub:**

1. Check the GitHub CLI is signed in (`gh auth status`). If not, run `gh auth login --web` and walk me through it.
2. Unzip `incoming-report/nextchapter-displacement-report-replication.zip` into a new folder outside the website repo: `~/nextchapter-displacement-report`.
3. In that folder:
   - Run `git init`.
   - Add a `.gitignore` covering `__pycache__/`, `*.pyc`, `x13_run*` and `.env`.
   - Check for a real API key: search for `CENSUS_API_KEY=` followed by a long string of letters and numbers. The placeholders `...` and `"<your-free-key>"` are fine. Stop and tell me if you find a real key.
4. Commit with the message "Replication materials for NextChapter Displacement Report v1.71".
5. Create a **public** repository named `nextchapter-displacement-report`:
   - Description: "Code, parameters and derived data for the NextChapter Displacement Report (white-collar labor market)".
   - Push to it and show me the URL.
   - Add the topics `labor-market`, `unemployment`, `current-population-survey`, `ai`, `economics` and `open-data`.

**If the repository already exists (from 1.4):**

1. Unzip the new zip over `~/nextchapter-displacement-report`, keeping `.git`. New since 1.4:
   - `code/08_industry_productivity.py` and `data/industry_productivity_vs_long_searches.csv`
   - `code/09_nativity_and_age_standardization.py`, `data/cps_nativity_jan_aug_2019_2025_2026.json` and `data/cps_55plus_age_sex_cells_2025_2026.json`
   - `code/10_hidden_displacement.py`, `data/cps_hidden_displacement_wc_jan_aug_2019_2025_2026.json` and `methodology/change_record_standard.md`
   - `code/11_exposure_vs_outcomes.py`, `code/12_education_experience.py` and their data files in `data/`
   - updates to `README.md` and `CHANGELOG.md`
2. Run the same key check as above.
3. Commit "v1.71: AI exposure vs outcomes, education and experience (and earlier v1.5–1.7 additions)" and push.

## 2. Replication page on the site (skip if it exists; otherwise create it)

1. Create `src/app/reports/replication/page.tsx`: a short, server-rendered page titled "Displacement Report: replication materials", using the site's normal public-page layout. It should:
   - explain in two sentences what the materials are
   - link prominently to the GitHub repository
   - list what can be reproduced, using the table in the repo's README (which now includes the industry-productivity and nativity scripts)
   - link to the report and its methodology appendix (`/reports/displacement-report-september-2026#method`)
   - give the corrections email, jkulla@launchyournextchapter.com
   - set the canonical URL `https://launchyournextchapter.com/reports/replication`, plus a meta description
2. Add the page to the sitemap.
3. In the report's Dataset JSON-LD, add the repository URL as `isBasedOn` (`SoftwareSourceCode` with `codeRepository`).
4. If the page already exists, just make sure its reproducible-items list includes "Industry productivity vs long searches (Q3 feature)" and "Nativity breakdown and age-sex standardized 55+ participation" "Beyond-unemployment white-collar panel", "AI exposure vs outcomes by occupation" and "Education and experience breakdowns". Also link `methodology/change_record_standard.md` under a heading "How we record changes between editions".

## 3. Replace the edition page with version 1.71

1. **Port the source.** It is `incoming-report/displacement-report-september-2026.html` (version 1.71). Port it into `src/app/reports/displacement-report-september-2026` as before:
   - server-rendered text
   - scoped CSS, including the `.lbl`, `.lbl-row`, `.src` and `table.txt` rules
   - the chart script via `next/script`
2. **Keep** the newsletter signup in place of `#newsletter-slot`, the pop-up, and the PDF email gate with its "Media or researcher? Download directly" link.
3. **What's in the page.** From 1.4, kept:
   - BLS-method margins of error
   - the seasonal-adjustment and job-losers exhibits
   - the evidence-hierarchy box
   - the "What we measure / What others find / What this may mean" labels
   - the hires-per-opening chart
   - the net-productivity ledger
   - source links

   **New in 1.5:**
   - **Chapter 09, renamed "Skills, career ladders and colleges":**
     - a career-ladder table (promotions, internal hiring, management layers)
     - an employer-training table (Training magazine vs ATD vs SHRM)
     - a table of college AI programs by career stage (undergraduate, mid-career, MBA, executive education, professional degrees, alumni), plus evidence and skeptics
   - **Chapter 13, renamed "The safety net, policy and public retraining":** a new section on public retraining. It has a WIOA Dislocated Worker funding-and-results table, plus items on the funding outlook, AI guidance (TEGL 03-25, TEGL 15-25), Workforce Pell, Trade Adjustment Assistance and the evidence on training.
   - **Q3 addendum:** a new annual feature, "Industry productivity versus long job searches" (new exhibit).
   - **Future Research Agenda:** two new rows (productivity per AI token; productivity by function, seniority and place).
   - **Elsewhere:** two new executive-summary bullets, version log 1.5, and audit and source updates.
   - **New in 1.6:**
     - **Correction box in Chapter 07:** the 55+ participation drop is compositional; it was removed from the executive summary. Keep the box visible.
     - **Chapter 04:** a new "Immigration" section (anchor `#immigration`) with a nativity exhibit, H-1B, student and migration items, and research.
     - **Chapter 02 and the executive summary:** "breakeven" job-growth context.
     - **Chapter 15:** a "Use-case watch" table (film/TV, customer service, software, legal, banking, accounting).
     - **FAQ:** a new immigration question, also in the FAQ JSON-LD.
     - **Q3 addendum:** the net-productivity ledger is now labeled an illustrative scenario and is no longer in the executive summary; the revenue-per-employee exhibit has a "selected sample" caveat.
   - **New in 1.7:**
     - **Chapter 01:** a new "Beyond unemployment" section (anchor `#hidden`) with an exhibit.
     - **New feature:** "The rewiring constraint" (anchor `#feature-rewiring`), placed before the Future Research Agenda, with a three-speed scorecard exhibit. Add it to the table of contents (the source already has the entry).
     - **Chapter 08:** three new research items.
     - **Future Research Agenda:** four new rows.
     - **Appendix B:** a new "Edition-to-edition change record" subsection.
     - **Cover:** a new line, "Source data available through October 2, 2026 (CPS microdata through August)".
   - **New in 1.71:**
     - **Chapter 04:** "Do occupations more exposed to AI fare worse?" (anchor `#exposure`).
     - **Chapter 06:** "The degree-holding core: education and experience" (anchor `#core`).
     - **Chapter 09:** "The cost side of the degree: price, completion, payback and debt" (anchor `#debt`).
     - **Feature:** a "conversational threshold" postulate with a customer service test (anchor `#turing`).
     - **Elsewhere:** two scorecard rows and four executive-summary bullets.
   - **Exhibits renumbered:** there are now 46.
4. **Replace or add these files in `public/reports/`:**
   - `displacement-report-2026-09.pdf`: version 1.71 full report, **48 pages**
   - `displacement-report-2026-09-brief.pdf`: version 1.71 brief, **11 pages**
   - `displacement-report-2026-09-data.csv`: new rows for nativity, the 55+ adjustment, H-1B, the use-case watch, the industry comparison, WIOA, careers, training and colleges
   - `nextchapter-carousel-2026-09.pdf` (**replace**: slide 7 is now about immigration)
   - From 1.4, if missing:
     - `displacement-report-2026-09-og.png`
     - `sec-item205-ai-coding-2026.csv`
     - `displacement-report-2026-q3-revenue-per-employee.csv`
     - `wc-index.csv`
5. **Two PDFs on the page.** The cover has "Full report (PDF, 48 pages)" (`#pdf-btn`) and "Brief (PDF, 11 pages)" (`#brief-btn`):
   - **Brief:** free, with no email gate.
   - **Full report:** behind the existing email gate. Keep the "Media or researcher? Download directly" link.
   - **Tracking:** a PostHog event `report_brief_downloaded` (add it if it isn't already there).
6. **Metadata:**
   - Set the JSON-LD `version` to "1.71". Set both `dateModified` and `article:modified_time` to 2026-10-06.
   - Point `og:image` at `/reports/displacement-report-2026-09-og.png?v=1.71`.
   - Use this meta description (it's in the source file's head too): "…Q3 addendum on revenue per employee, AI in SEC restructuring filings and industry productivity; career ladders, college AI programs, WIOA retraining, immigration and H-1B, an AI use-case watch, hidden displacement, the rewiring constraint, AI exposure by occupation, degree holders by education and experience, college costs and student debt, states and policy."
   - Keep the "Corrected October 6, 2026" note near the top; it should link to both correction boxes (Chapter 03 and Chapter 07).
   - List both PDFs in the Dataset JSON-LD `distribution`.
   - The cover line reads "Reference period: September 1–30, 2026".

## 4. News item

Add or update the news item using `scripts/displacement/add-news-item.ts`:

- Title: "Displacement Report v1.71: AI exposure by occupation, the degree-holding core and student debt"
- Body (short paragraph): "The report finds the rise in long job searches is among U.S.-born professionals, not explained by immigration, and corrects our reading of older workers' participation. Version 1.7 adds a check for displacement hidden inside jobs (none found so far), a feature on why AI capability is outrunning organizational change, and a standing change-record policy. Version 1.71 tests AI exposure against outcomes across occupations, tracks bachelor's and master's holders by experience, and adds college costs and student debt. It also includes career-ladder and training data, AI programs at colleges by career stage, WIOA retraining results and a monthly AI use-case watch."
- Link it to the report. If earlier news items exist, keep them and add this one.

## 5. Checks

1. Run `npm run build` and `npm run lint`.
2. Run Lighthouse on the report and replication pages. SEO and Accessibility scores must not drop.
3. Take desktop and phone screenshots of:
   - the cover (both PDF buttons)
   - the new Chapter 09 tables (career ladders, employer training, colleges by career stage)
   - the Chapter 04 nativity exhibit and the Chapter 07 correction box
   - the use-case watch table in Chapter 15
   - the Chapter 01 "Beyond unemployment" exhibit and the rewiring-constraint feature with its scorecard
   - the Chapter 04 exposure exhibit, the Chapter 06 education/experience exhibit, the Chapter 09 college-cost and debt exhibit, and the customer service test
   - the WIOA table in Chapter 13
   - the new Q3 industry-productivity exhibit
   - the replication page
   - the pop-up and the PDF gate

   On a phone, tables must scroll sideways inside their box, not the whole page.
4. Confirm the GitHub repository is public and its README renders.
5. Wait for me to type `deploy`.
6. After deploying:
   - Run the IndexNow script for the report URL and the replication URL.
   - Then tell me to:
     1. Refresh the LinkedIn link preview at https://www.linkedin.com/post-inspector/ (paste the report URL, click Inspect).
     2. Request re-indexing of both pages in Google Search Console.
