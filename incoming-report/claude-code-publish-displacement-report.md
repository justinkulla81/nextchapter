# Publishing the NextChapter Displacement Report

This file has three parts:

- **Part A** is for you: what to do, step by step.
- **Part B** is the prompt you paste into Claude Code (run it in your `~/nextchapter` folder).
- **Part C** is the monthly routine, also a Claude Code prompt.

---

## Part A: Your steps (do these in order)

### 1. Put the files in your project

1. Open Finder. Go to your home folder, then `nextchapter`.
2. Make a new folder inside it called `incoming-report`.
3. Drag these files from this chat into `incoming-report`:
   - `displacement-report-september-2026.html`
   - `displacement-report-2026-09-data.csv`
   - `displacement-report-2026-09-og.png`
   - `displacement-report-2026-09.pdf` (the downloadable PDF edition)
   - `wc-index.csv` (the White-Collar Index history)
   - `nc_white_collar_index.py`
   - `nc_openings_and_aiwashing.py`

### 2. Add your keys to the project

1. In the `nextchapter` folder, open the file `.env.local` in a text editor. It already has your other keys in it.
2. Add these two lines at the bottom:
   ```
   CENSUS_API_KEY=paste-your-census-key-here
   SEC_USER_AGENT=NextChapter Research yourname@launchyournextchapter.com
   ```
   The second line must be a real address you read. The SEC asks automated tools to identify themselves this way.
3. Save the file. Do not share this file with anyone.

### 3. Run Claude Code

1. Open Terminal.
2. Type `cd ~/nextchapter` and press Enter.
3. Type `claude` and press Enter.
4. Copy everything in **Part B** below, paste it in, and press Enter.
5. When Claude Code shows you the changes and the checks, read them. If the page looks right, type `deploy`.

### 4. Tell Google about the new pages (one time)

1. Go to **search.google.com/search-console** and sign in with your Google account.
2. Click **Add property** and choose **Domain**. Type `launchyournextchapter.com` and click **Continue**.
3. Google shows a line of text that starts with `google-site-verification=`. Click **Copy**.
4. Log in to the website where you bought your domain. Find **DNS** settings and add a new **TXT** record:
   - Name/Host: `@`
   - Value: paste the line you copied
5. Save, go back to Google, and click **Verify**. If it fails, wait 30 minutes and try again.
6. In Search Console's left menu, click **Sitemaps**. Type `sitemap.xml` and click **Submit**.
7. At the top, paste `https://launchyournextchapter.com/reports/displacement-report-september-2026` into the search bar and press Enter. Click **Request indexing**.
8. Do step 7 again for `https://launchyournextchapter.com/reports` and `https://launchyournextchapter.com/reports/white-collar-index`.

### 5. Tell Bing (this also feeds ChatGPT search and Copilot)

1. Go to **bing.com/webmasters** and sign in.
2. Click **Import** and choose **Google Search Console**. Approve it.
3. Click **URL Submission** and paste the same three addresses.

### 6. Google News (optional, takes a few weeks)

1. Go to **publishercenter.google.com** and sign in.
2. Click **Add publication** and enter NextChapter and your website.
3. Fill in the **About** section, add your logo, and add the `/reports` section as a news section.

---

## Part B: Paste this into Claude Code

You are adding original research pages to the NextChapter Next.js site (App Router in `src/app`, Prisma, deployed on Vercel). The source files are in `incoming-report/`. The goal is to get these pages found and cited by Google, Bing and AI answer engines. Read `CLAUDE.md` and `AGENTS.md` first and follow their conventions. Show me the full diff and the checks before deploying.

### 1. Report page: `src/app/reports/displacement-report-september-2026/page.tsx`

- Port `incoming-report/displacement-report-september-2026.html` into a **server component**. Every word of the report must be in the HTML the server sends; nothing may render client-only.
- Scope the report's CSS to the page (CSS module or a wrapper class) so it does not affect the rest of the site.
- Load the small chart script with `next/script` (`strategy="afterInteractive"`). The page must read fine without it.
- Use the normal site header, footer and nav.
- Copy the CSV, `wc-index.csv`, the PNG and the PDF to `public/reports/`. The "Download PDF" button must point to `/reports/displacement-report-2026-09.pdf` with the `download` attribute, and the data links to `/reports/displacement-report-2026-09-data.csv` and `/reports/wc-index.csv`. The page's small script only takes over these buttons inside the Claude viewer (`window.claude`); on the website they must work as normal links.
- Keep the report's print styles: the PDF is generated from the same page, so the cover, exhibits and appendix should stay as authored.

### 2. White-Collar Index page: `src/app/reports/white-collar-index/page.tsx`

This is the evergreen page we want to rank and be cited.

- **Data:** copy `incoming-report/wc-index.csv` to `public/reports/wc-index.csv` and read it at build time.
- **H1:** "NextChapter White-Collar Displacement Index".
- **Top of page:** the latest value, change from a year ago, and a one-paragraph plain-English definition.
- **Chart:** server-render a line chart of the index since 2015 as inline SVG. Mark the 2019 baseline (= 100) and leave a visible gap for the missing October 2025 month.
- **Companion table:** last 13 months of
  - white-collar unemployment rate
  - long-term share of the white-collar unemployed
  - median weeks unemployed
  - long-term share for white-collar workers 45+
  - job losers vs. job leavers
- **Methodology section** (definitions are in the header of `nc_white_collar_index.py`):
  - CPS public-use microdata
  - PRMJOCC1 groups 1–2
  - 27+ weeks counts as long-term
  - composite weight
  - not seasonally adjusted
  - 3-month moving average
  - 2019 = 100
  - October 2025 not collected
- **How to cite:** a box with the citation and a CC BY 4.0 license line.
- **Download:** a link to the CSV.
- **JSON-LD:** a `Dataset` (name, description, `temporalCoverage` "2015-01/latest", `variableMeasured`, `distribution` with the CSV, license CC BY 4.0, creator NextChapter, `isAccessibleForFree: true`).

### 3. Hub: `src/app/reports/page.tsx` and `/reports/latest`

- **Data source:** `src/lib/reports.ts` exports a typed array of editions: `slug`, `month`, `title`, `dek`, `publishedAt`, `ogImage`. Next month should be a one-line addition.
- **Hub content:**
  - H1 "NextChapter Displacement Report"
  - a two-sentence description of the monthly series
  - a card with the latest Index value that links to the index page
  - a "Latest edition" card
  - an archive list
  - the release calendar ("published within two business days of the BLS jobs report")
- **`/reports/latest`:** a 307 redirect to the newest edition.
- **Newsletter signup:** add a signup box to the hub, the report and the index page. It saves to the existing `NewsletterSubscriber` table with `source = 'displacement-report'`. Reuse the existing signup component or API if there is one.

### 4. Metadata for each page (`generateMetadata`)

- **Report**
  - title: `September 2026 White-Collar Jobs & Layoffs Report: AI, Long-Term Unemployment | NextChapter`
  - description: `Monthly white-collar displacement report: 27.1% of the unemployed out 27+ weeks, AI cited in 21% of 2026 layoffs vs ~5% of SEC filings, senior openings down 20%, plus WIOA, benefits and age trends.`
- **Index**
  - title: `White-Collar Displacement Index: Long-Term Unemployment for Professionals | NextChapter`
  - description: generate it from the latest value.
- **Hub**
  - title: `NextChapter Displacement Report: Monthly White-Collar Labor Market Data`
- **Every page:**
  - canonical URL
  - Open Graph and Twitter `summary_large_image` tags, using the PNG
  - `article:published_time` and `article:modified_time`
  - author Justin Kulla
- **Report JSON-LD:** keep the Report + FAQPage block from the HTML. Add `image`, `url`, `mainEntityOfPage` and `dateModified`, plus a `BreadcrumbList` (Home → Reports → September 2026).
- **Author:** add a short author box (Justin Kulla, founder of NextChapter; former CTO and private-equity investor; lecturer at Stanford and MIT). Link it to an `/about#justin-kulla` anchor with `Person` JSON-LD (`sameAs`: his LinkedIn URL from the About page).

### 5. Make /news show it

Add one `ResearchLibraryItem` row with:

- `status 'reviewed'`, `newsKind 'report'`, `newsSource 'NextChapter Research'`
- `newsPublishedAt` = publish date
- `newsTags ['reports','data']`
- `url` = the report URL, `newsSlug` = the report slug
- `newsImageUrl` = the PNG
- `newsTitle` = `Fewer layoffs, longer searches: the September 2026 white-collar displacement report`
- `newsBlurb` = the meta description

Generate the id the way the app does. If the /news card only handles external links, add a `report` variant labeled "NextChapter Report" that opens in the same tab, and pin it to the top for 30 days.

### 6. Crawlability

- **`src/app/sitemap.ts`:** add `/reports`, `/reports/white-collar-index` and every edition, with `lastModified`.
- **`src/app/news/feed.xml`:** add each edition.
- **`src/app/robots.ts`:** leave it as is. Public pages are already open to search and AI crawlers.
- **IndexNow (for Bing and others):**
  - Generate a key.
  - Serve it at `/<key>.txt` from `public/`.
  - Add `scripts/displacement/indexnow.ts`, which POSTs the new URLs to `https://api.indexnow.org/indexnow`.
- **Internal links:** point descriptive anchor text at `/reports/latest` and `/reports/white-collar-index` from:
  - the homepage footer
  - the /news header
  - `/government-workforce`, `/outplacement` and `/for-organizations`
  - the 3–5 most relevant `/resources/*` guides (unemployment benefits, long search, layoffs, older workers)

### 7. Pipeline scripts

- Move `nc_white_collar_index.py` and `nc_openings_and_aiwashing.py` to `scripts/displacement/`.
- Add npm scripts:
  - `report:index` runs the index script into `public/reports/wc-index.csv`, using `CENSUS_API_KEY` from `.env.local`.
  - `report:companions` runs the openings and AI-washing script against `~/nextchapter-jobs/data/jobs.db`.
- Add `scripts/displacement/README.md` explaining both scripts and their definitions.

### 8. Checks before deploy

- Run `npm run build` and `npm run lint`.
- On the preview deployment, curl each new page and confirm the HTML contains:
  - the H1
  - "27.1%" (report) or the latest index value (index page)
  - the canonical tag, `og:image` and JSON-LD that parses
- Run Lighthouse on the report and index pages and report the SEO and performance scores. Fix anything below 90 on SEO.
- Show me the diff and the results, then deploy when I say so. After deploy, run the IndexNow script for the new URLs.

---


### Editorial and statistical standards (apply to every edition)

- Disclosure box at the top (publisher, commercial interest, author, funding, review status); NextChapter services appear only in the final "About NextChapter" section.
- Fixed list of monthly measures (Appendix B of the report) reported whether they rise or fall.
- Survey-microdata figures carry 90% margins of error using the method in Appendix B; label a change "significant" only when it exceeds its margin; suppress groups with fewer than ~100 unemployed respondents; show respondent counts.
- The White-Collar Index is seasonally adjusted (factors in the report's methodology); never compare a non-adjusted month to an annual average.
- Spell durations are "unemployed so far," never "time to find work."
- Label every figure SA or NSA and its period; when two sources give different values for the same concept, say why next to them.
- Layoff totals: lead with the figure excluding government when government cuts distort the comparison.
- SEC comparison: count distinct filings, hand-check the AI passages, separate risk-factor mentions from restructuring disclosures, publish the query.
- No causal claims about AI from occupation or industry tables; title them by what they show.
- Vendor and survey sources are labeled as such; pilots and field notes stay in Appendix A.
- Version number and version log; corrections noted with dates; data files updated to match.
- Generate the PDF from the page with print styles and page numbers, and keep the "Download PDF" button pointing to it.

## Part C: Monthly routine (paste into Claude Code after each BLS jobs report)

The BLS jobs report comes out at 8:30 a.m. Eastern, usually on the first Friday of the month (next: Nov 6 and Dec 4, 2026). The Census microdata for that month usually posts one to two weeks later. Publish the report within two business days of BLS, and refresh the Index when the Census file lands.

> Monthly Displacement Report update for <MONTH YEAR>.
> 1. Run `npm run report:companions` for <MONTH> vs <PREVIOUS MONTH>. Show me the senior openings and AI-washing numbers.
> 2. If Census has published <MONTH> microdata, run `npm run report:index`. Otherwise keep last month's Index and mark it "through <last month>".
> 3. Create `src/app/reports/displacement-report-<month>-<year>/` by copying last month's page. Update every number from:
>    - the BLS Employment Situation release
>    - JOLTS
>    - Challenger
>    - DOL weekly claims
>    - the Atlanta Fed wage tracker
>    - the two scripts above
>
>    Every number needs a source; flag any you could not verify.
> 4. Rewrite "The balance this month" with honest positives and negatives, and refresh the "What to watch" calendar.
> 5. Add the edition to `src/lib/reports.ts` and make a new 1200×630 share image.
> 6. Run the checks from Part B, step 8. Deploy when I approve, then run the IndexNow script and add the /news row.
