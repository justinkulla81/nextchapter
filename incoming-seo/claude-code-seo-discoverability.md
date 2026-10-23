# NextChapter discoverability: Claude Code prompts

Three prompts. Run them in order, one per Claude Code session. Each one ends by showing you the changes and checks before anything goes live.

**Before you start:** your repo has uncommitted changes (Higher Ed, workforce boards, news, sitemap and others). Ask Claude Code to finish and commit that work first, so these changes don't get mixed in with it.

**How to run each prompt:**

1. Open Terminal.
2. Type `cd ~/nextchapter` and press Enter.
3. Type `claude` and press Enter.
4. Paste the prompt and press Enter.
5. Review what it shows you, then type `deploy` when it looks right.

---

## Prompt 1: Technical fixes and trust signals (do this first; mostly small, high-impact)

> You are improving search and AI-answer discoverability for launchyournextchapter.com (Next.js App Router in `src/app`, Prisma, Vercel). Read `CLAUDE.md`, `AGENTS.md` and `design-principles.md` first and follow them. Do not change page copy except where listed. Show me the full diff and the check results before deploying.
>
> **A. Fix the canonical bug (critical).**
>
> - The problem: `src/app/layout.tsx` sets `alternates: { canonical: "/" }`, and every page without its own canonical inherits it. In production, `/pricing` declares `https://launchyournextchapter.com` as its canonical, which tells Google that page is a duplicate of the homepage.
> - Remove the canonical from the root layout.
> - Add a small helper, e.g. `src/lib/seo/canonical.ts`, that returns `{ alternates: { canonical: path } }`.
> - Give every public page its own self-referencing canonical, including dynamic routes (`[slug]`, `[persona]`, `[competitor]`). Pages currently missing one include: `/employers`, `/membership`, `/pricing`, `/dossier`, `/security`, `/scorecard`, `/for-managers`.
> - Then list every public route and its canonical so I can see none point to `/`.
>
> **B. Fix duplicated brand in titles.**
>
> - The root title template already appends ` | NextChapter`, so titles like `Pricing — NextChapter` render as "Pricing — NextChapter | NextChapter".
> - Remove "— NextChapter" from page-level titles (including `/start/[persona]`), so each title reads "<Page> | NextChapter".
> - Keep titles under about 60 characters.
>
> **C. Sitemap.**
>
> - Make sure `src/app/sitemap.ts` includes all of the following, each with a real `lastModified` (from content dates where available, not `new Date()` on every build):
>   - every public, indexable page: `/reports`, `/reports/white-collar-index`, every report edition
>   - `/insights` and its articles
>   - `/vs` and each competitor page
>   - `/talent`
>   - `/news/[slug]` pages
>   - `/resources` guides
>   - `/start/[persona]` pages
> - Remove `/auth/login`; login pages shouldn't be in a sitemap.
> - Cross-check against `robots.ts` so nothing disallowed is listed.
>
> **D. Author and editorial trust signals.**
>
> 1. **Author page.** Create `/authors/justin-kulla`. Use the bio facts already on `/about`: founder of NextChapter; MIT, Harvard, Carnegie Mellon; former CTO; education-technology founder, operator and investor. Add Stanford and MIT lecturer only if `/about` already states it; otherwise leave a TODO for me.
>    - Add a headshot if the asset exists.
>    - Add `Person` JSON-LD with `sameAs` set to the LinkedIn URL already used on the site.
>    - List the reports and guides he authored.
> 2. **Author box component.** Show "By Justin Kulla" with a link to the author page and "Last updated <date>" on every `/resources` guide, `/insights` article, `/news/[slug]` page and report.
> 3. **"Reviewed by" support.** Add an optional `reviewedBy` field to guide content. Render "Reviewed by <name>, <credential>" only when it is set; don't invent reviewers.
> 4. **Editorial standards page.** Create `/editorial-standards` covering:
>    - how NextChapter researches and sources content
>    - that NextChapter sells career-transition services and how content is kept separate from that
>    - the corrections policy and contact
>    - a link to the Displacement Report methodology
>
>    Link it in the site footer.
> 5. **Article JSON-LD.** Add `Article` JSON-LD (`headline`, `author` → the Person, `publisher` → the existing Organization, `datePublished`, `dateModified`, `image`, `mainEntityOfPage`) to every guide, insight and news-with-take page. Reuse `src/components/StructuredData.tsx`.
> 6. **Breadcrumbs.** Add `BreadcrumbList` JSON-LD to every nested public page.
>
> **E. Guide indexability.**
>
> - Check whether `/resources/*` guides show their full text in the server-rendered HTML or hide most of it behind the email unlock.
> - Report what share of each guide's words a crawler can see.
> - Don't change the gating yet. Give me a recommendation: either show the full guide to crawlers and readers and keep the email for a downloadable PDF, or keep at least 600 words of useful content ungated.
>
> **F. Checks.**
>
> 1. Run `npm run build` and `npm run lint`.
> 2. Run a broken-link check across the built site (for example `npx linkinator` against `next start`) and fix internal 404s.
> 3. Run Lighthouse (mobile) on: `/`, `/resources/unemployed`, `/reports/displacement-report-september-2026`, `/pricing`, `/news`.
> 4. Report Performance, SEO, Accessibility and Best Practices, plus LCP, CLS and TBT. Fix any SEO issue and anything that drops Performance below 80 if the fix is simple: image sizes, font loading, render-blocking scripts, missing alt text.
> 5. Show me the canonical list, sitemap URL count before and after, the Lighthouse table and the diff. Then deploy when I say so.

---

## Prompt 2: Answer engines (ChatGPT, Perplexity, Google AI)

> You are improving how launchyournextchapter.com appears in AI answers. Read `CLAUDE.md` first. Show me the diff before deploying.
>
> **A. Update `public/llms.txt`.**
>
> - Keep the current structure and add:
>   - a "Research and data" section: `/reports`, `/reports/white-collar-index`, the latest edition, the layoff tracker, `/editorial-standards`
>   - a one-line description of each
> - Use the product terms the site actually uses today. Check whether it is "Market Reality Grade", "Hireability Grade" or "Current Market Reality" across the homepage, FAQ, llms.txt and metadata, list every variant you find, and ask me which name is canonical before changing any of them.
> - Also generate `public/llms-full.txt` with the plain-text body of every guide and report (no navigation or boilerplate), regenerated at build time.
>
> **B. Answer-first content.**
>
> - For each `/resources` guide and `/insights` article, check that the first paragraph directly answers the page's main question in one or two sentences.
> - Where it doesn't, propose a short answer paragraph (shown to me as a list, not applied) so I can approve the wording.
> - Do not rewrite other copy.
>
> **C. FAQ markup.**
>
> - Where a guide or insight already contains question-and-answer content, add `FAQPage` JSON-LD from that existing text. Never invent questions or answers.
> - Keep the FAQ on `/faq` and the report.
>
> **D. Consistent facts.**
>
> - Create `src/lib/seo/facts.ts` holding the facts AI tools quote: what NextChapter is, who it is for, price for candidates (free), founder, founding year if known, contact.
> - Use it in llms.txt, the Organization JSON-LD and the About page metadata, so they never disagree.
>
> **E. Crawler access.**
>
> - Confirm `robots.ts` allows GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended and Bingbot on public pages. They are currently governed by the `*` rule; keep it that way, and just report the result.
> - Confirm the IndexNow key and script from the report work exist, and run IndexNow for every URL changed in this deploy.

---

## Prompt 3: Data-driven pages people search for

> You are building pages for searches laid-off professionals run every day, using data NextChapter already has or can source from official sources. Read `CLAUDE.md` first. Legal guardrails (from the V1 rules):
>
> - no employer rankings or "worst employer" lists
> - no information about individual workers
> - deep-link only for sources whose terms restrict copying
>
> Show me the diff and sample pages before deploying.
>
> **A. Layoff tracker as its own section** (`/layoffs`).
>
> 1. **Hub.** The tracker currently lives at `/news#layoff-tracker`. Give it its own home at `/layoffs`, using the `WarnNotice` and `LayoffNewsMention` data and the existing tracker components.
>    - Keep the honest-coverage note and the BLS context already in the tracker.
>    - Link to it from `/news`.
>    - Redirect nothing; just add a "full tracker" link.
> 2. **State pages** (`/layoffs/[state]`):
>    - WARN notices in that state for the last 12 months, newest first: date, employer, city or county, number of workers, layoff type, source link
>    - state unemployment rate and payroll change from the latest Displacement Report data
>    - the local workforce boards already matched to notices, with their job-center links
>    - a link to that state's unemployment benefits page (part B)
>    - a coverage note giving the date range and sources NextChapter collects for that state
>
>    Generate state pages only where there is at least one notice in the last 12 months; for the rest, show the hub with a coverage note.
> 3. **Company pages** (`/layoffs/company/[slug]`), one per normalized employer with at least one notice:
>    - every notice for that employer (date, location, workers, type, source)
>    - matched news mentions
>    - the local workforce board for each location
>    - "What to do if you're affected," linking to `/start/laid-off`, the state benefits page and relevant guides
>    - title pattern: "<Employer> layoffs: WARN notices and dates | NextChapter"
>    - factual wording only, no adjectives about the employer
> 4. **Indexing rules.**
>    - Revalidate daily.
>    - Add hub, state and company pages to the sitemap with `lastModified` = latest notice date.
>    - Add `noindex` to any company page whose only notice is older than 24 months.
>
> **B. Unemployment benefits by state** (`/unemployment-benefits` hub plus `/unemployment-benefits/[state]` for all 50 states and DC).
>
> 1. **Fields for each state:**
>    - maximum and minimum weekly benefit
>    - maximum weeks of benefits, and whether duration varies with the state unemployment rate
>    - waiting week
>    - how severance and payments in lieu of notice affect eligibility
>    - how to file (official state agency link)
>    - work-search requirements
>    - extended benefits status
>    - the state's local workforce boards
> 2. **Sourcing rules (strict).**
>    - Use only official sources: the U.S. Department of Labor's "Comparison of State Unemployment Insurance Laws" and "Significant Provisions of State UI Laws" (latest editions), and each state agency's own site.
>    - Store the data in a typed file, `src/lib/data/state-ui.ts`, with `source` URL and `asOf` date for every field.
>    - Where official sources disagree or you cannot confirm a value, leave it null and show "Check with <agency>" on the page.
>    - Never estimate.
>    - Show "Last verified <date>" on each page, and add a yearly re-verification checklist to `docs/`.
> 3. **Page content.** Each page opens with a two-sentence direct answer, e.g. "In <State>, unemployment benefits last up to N weeks and pay up to $X a week (as of <date>)." It then shows:
>    - a fields table
>    - a section on severance
>    - "If you're a laid-off professional" with links to `/resources/unemployed`, `/resources/cobra-aca`, `/resources/bridge-income` and the state layoff page
>    - FAQ JSON-LD built from the table values
> 4. **Hub.** A sortable table of all states, plus a link to the Displacement Report's unemployment-insurance exhaustion data.
>
> **C. White-Collar Index page polish** (`/reports/white-collar-index`).
>
> - Start with one sentence giving the latest value and its change.
> - Add `FAQPage` JSON-LD for three questions answered from the page itself: what the index is, how it is calculated, and how often it updates.
> - Make sure the `Dataset` JSON-LD points to `/reports/wc-index.csv`.
>
> **D. Internal links.**
>
> - Link `/start/laid-off` and the relevant guides to `/unemployment-benefits` and `/layoffs`.
> - Link each state benefits page and state layoff page to each other.
> - Use descriptive anchor text.
>
> **E. Checks.**
>
> 1. Build, lint, and run the broken-link check.
> 2. Run Lighthouse on `/layoffs`, one state layoff page, one company page, `/unemployment-benefits/california` and `/unemployment-benefits/texas`.
> 3. Show me five sample pages with their source citations.
> 4. Report the number of new indexable URLs.
> 5. Run IndexNow for the new URLs after deploy.

---

## After each deploy (you)

1. In Google Search Console, go to **Sitemaps** and click `sitemap.xml` to resubmit it.
2. Use **URL Inspection** → **Request indexing** for the new hub pages: `/layoffs`, `/unemployment-benefits`, `/authors/justin-kulla`, `/editorial-standards`.
3. Two to four weeks later, check **Pages** (indexed vs not) and **Performance** (impressions) in Search Console.
