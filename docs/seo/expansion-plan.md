# SEO expansion plan: tactics and keyword backlog

Owner request (2026-10-26): more traffic, an expansive keyword list, and the tactics employers.io uses.

## What employers.io does (read from its public homepage; its sitemap and schema were not visible to us)

| Tactic | What we saw | NextChapter status |
| --- | --- | --- |
| Free tools on their own utility URLs | `/free-resume-checker`, `/salary-calculator`, `/salary-converter`, `/tax-calculator-usa` | Live: `/tools`, `/tools/severance-calculator`, `/tools/warn-act-checker`. Next: salary converter, take-home pay after layoff, unemployment total-benefit estimator, public resume checker (the Resume Studio test exists behind signup) |
| Country/locale qualified tool pages | `/tax-calculator-usa` | We are US only. State-qualified versions: `/tools/severance-calculator/<state>` once state severance and final-pay rules are sourced |
| Search-intent pages for job titles, work types, locations, schedules | Stated on the page; URLs not visible | Live: `/jobs/<id>`, `/employers/<slug>`, `/places/...`, `/industries/...`, `/functions/...`. Next: title and level pages (`/jobs/title/<title>`), remote and part-time landing pages, from the job database |
| Company insights | `/company` | Live: employer pages and layoff pages. Next: link each from job pages |
| Audience-split sections | `/employers/*` vs job seeker pages | Live: portal pages |
| AI answer-engine visibility | Stated goal: be cited in ChatGPT and similar | Live: `llms.txt` with topic section, `llms-full.txt` with topic text, FAQ/Article/DefinedTermSet/WebApplication JSON-LD, crawler allow-list in robots.ts |
| Alerts and re-engagement | Email and SMS job alerts | Job alert emails are OFF by decision; not changed here |
| Trust signals | Reviews link, partner logos | Not added: no reviews or logos we can substantiate |
| Owned-domain acquisition | Bought Job-Applications.com | Not applicable |

## Built 2026-10-26 from the job database

- `/salaries` and `/salaries/<title>`: median and middle half of stated pay, by state, with Occupation salary markup. About 450 titles (40+ open listings, 25+ with usable annual pay).
- `/jobs/title` and `/jobs/title/<title>`: open jobs by title, about 1,300 titles with 40+ open listings.
- `/jobs/type/<remote|hybrid|contract|part-time|interim>`.
- Listed in `/salaries/sitemap.xml`. Thresholds are in `src/lib/seo/job-title-rules.ts`; lowering them adds pages but thins them.
- Life-situation and how-to topics added under `/topics`: laid off at 40/50, laid off with no savings, explain a layoff in an interview, how to lay off employees (employer side), cover letter tips.
- `noexperience/full`, `/lesson` and `/test` set to noindex (quiz steps); the `/noexperience` and `/eqoveriq` landing pages stay indexable with their own titles.
- Not built, with reasons: layoffs by industry (the `/industries/<slug>` pages already carry the layoff list), "layoffs this week" (the tracker hub lists the newest filings), per-state "how to file" pages (would duplicate the state benefit pages), career change by origin and target (needs the skills matrix and reviewed copy).

## Keyword backlog (not built yet; each needs one owner page before the phrase is claimed in `keywords.ts`)

Build order is by search demand times how well our own data can answer it. All are factual pages from data we hold; none needs a metered API.

1. **Salary and pay** (from posted pay in the job database): "[job title] salary", "[job title] salary [state]", "average salary for [function]", "salary by industry", "what does a [title] make". Owner: `/salaries/<title>` and `/salaries/<title>/<state>`.
2. **Jobs by title, level, type** : "[title] jobs", "[title] jobs near me", "director jobs", "vice president jobs", "remote [function] jobs", "part-time professional jobs", "contract jobs", "interim executive jobs", "fractional [role] jobs", "work from home jobs for managers". Owner: `/jobs/title/<slug>`, `/jobs/remote`, `/jobs/part-time`, `/jobs/contract`.
3. **Layoffs, deeper**: "[company] layoffs 2026", "tech layoffs", "healthcare layoffs", "bank layoffs", "federal layoffs", "AI layoffs", "layoffs this week", "layoffs by industry". Owner: `/layoffs/industry/<slug>`, `/layoffs/this-week`.
4. **Unemployment, deeper**: "unemployment benefits calculator [state]", "how to file for unemployment in [state]", "unemployment weekly claim", "unemployment denied appeal", "unemployment after quitting", "unemployment while on severance", "unemployment extension". Owner: state page sections, plus `/unemployment-benefits/<state>/how-to-file`.
5. **Resume and interview**: "resume summary examples", "executive resume examples", "resume for career change", "resume after being laid off", "cover letter after layoff", "interview questions for [function]", "why were you laid off interview answer", "how to explain a layoff". Owner: `/topics/...` and `/resources/...`.
6. **Job transition situations**: "laid off at 50", "laid off after 20 years", "laid off while pregnant", "laid off on medical leave", "laid off remote worker", "laid off with no savings", "laid off and a mortgage". Owner: `/start/...` sub-pages once the content is reviewed.
7. **Career change by origin and target**: "teacher to [role]", "lawyer to [role]", "nurse to [role]", "military to civilian", "[industry] to [industry] transition". Owner: `/topics/career-pivot/<from>-to-<to>` generated from the skills matrix.
8. **Coach, recruiter, services (commercial)**: "executive career coach cost", "best career coaches", "resume writing services", "outplacement for individuals", "executive search firms [industry]", "retained search firms list", "headhunters in [city]". Owner: `/coaching`, `/topics/executive-recruiters`, `/recruiters` local lists.
9. **Employer side**: "how to do a layoff", "layoff communication template", "layoff email template", "severance policy template", "WARN Act by state", "mini-WARN laws", "reduction in force policy". Owner: `/rapid-response`, `/tools/warn-act-checker`, new `/templates/...`.
10. **Benefits and funding**: "relocation assistance for laid off workers", "GI Bill", "Trade Adjustment Assistance", "dislocated worker program [state]", "free training for laid off workers". Owner: `/funding` and `/funding/<state>`.

## Backlog v2 (2026-10-30): high-intent and pain-point searches

Owner request: far more high-intent phrases, aimed at the moment a person decides to act: a layoff notice, a denied claim, a boss they cannot stand, a career they want out of. Coverage was checked against `keyword-map.md` on 2026-10-30. No search volumes are quoted here because none were measured; rank each cluster against Search Console queries (the site already has them) before building.

Build order is intent times urgency times how well we can answer it from sourced facts. Every page ends on the Market Reality Assessment. Pages that touch law, benefits or pay cite the agency (DOL, OPM, EEOC, the state UI agency), state the "as of" date, and say they are not legal advice. Professional and white-collar roles only (no hourly or "hiring now" phrases).

### Tier 1: build first

**A. RIF (reduction in force), employee side.** Today "reduction in force" appears only in the glossary and the employer WARN checker; nobody searching as an affected employee lands on a page written for them.
- Phrases: "what is a RIF", "reduction in force meaning", "RIF vs layoff", "RIF notice what to do", "got a RIF letter", "RIF severance pay", "RIF and unemployment", "how are employees chosen for a RIF", "RIF selection criteria", "am I on the RIF list", "RIF over 40 age discrimination", "OWBPA 45 days group layoff disclosure", "RIF on my resume", "can I be rehired after a RIF".
- Federal: "federal RIF rights", "federal RIF notice 60 days", "RIF appeal MSPB", "federal employee unemployment UCFE", "deferred resignation vs RIF", "VERA VSIP buyout", "RIF retreat and bump rights", "what happens to federal employees after RIF".
- Owners: new `/topics/reduction-in-force` (primary "what is a RIF") and `/topics/federal-rif`. Link the glossary entry and `/topics/fired-vs-laid-off` to them; keep `/tools/warn-act-checker` as the employer owner of "reduction in force notice".

**B. Unemployment, the stuck claim.** The state pages answer "how much" and "how to file"; nothing answers what happens next.
- Denied and appeals: "unemployment denied", "how to appeal unemployment", "unemployment appeal hearing", "unemployment overpayment waiver", "unemployment pending", "unemployment claim not paid", "why was my unemployment denied".
- Eligibility edge cases: "unemployment after quitting", "good cause to quit unemployment", "unemployment if fired", "fired for misconduct unemployment", "unemployment after a PIP", "unemployment self-employed", "unemployment for contractors and gig workers", "unemployment while working part time", "unemployment on severance" (owned), "unemployment after RIF".
- Running a claim: "how long until first unemployment payment", "when do unemployment payments arrive", "unemployment weekly certification", "unemployment work search log" (owned by `/topics/unemployment-and-job-search`), "unemployment extension", "what happens when unemployment runs out".
- Money: "is unemployment taxable", "1099-G unemployment", "unemployment tax withholding", "unemployment and health insurance".
- Owners: national topic pages (`/topics/unemployment-denied-appeal`, `/topics/unemployment-after-quitting-or-firing`, `/topics/unemployment-taxes-1099g`, `/topics/unemployment-extension`, `/topics/unemployment-payment-timing`, `/topics/unemployment-self-employed`), each linking to the right `/unemployment-benefits/<state>` page. State detail stays on the state pages so there is no second per-state family.

**C. "I hate my job" and the decision to leave.** The map has `/start/thinking-about-a-move` and `/start/resigned` but none of the words people actually type.
- Boss and workplace: "I hate my boss", "bad boss what to do", "toxic boss", "toxic work environment", "micromanager boss", "bullying at work", "my manager is undermining me", "coworker taking credit for my work", "how to deal with a boss you hate".
- Job: "I hate my job", "I hate my job but cant quit", "dread going to work", "Sunday scaries", "burned out at work", "burnout or wrong job", "bored at work", "no growth at my job", "feel stuck in my career", "quiet quitting", "return to office mandate quit".
- Decision: "should I quit my job", "should I quit without another job", "signs it is time to quit", "how to leave a toxic job", "how to resign professionally", "how to quit and what to say", "can I quit and collect unemployment" (links to B).
- Owners: `/start/hate-my-job` (primary "I hate my job"), `/topics/toxic-boss`, `/topics/job-burnout-or-wrong-job`, `/topics/should-i-quit-my-job`, `/topics/return-to-office-mandate`. Existing `/start/resigned` and `/topics/job-search-while-employed` receive the links.

**D. "I need a new job" now.**
- "I need a new job", "need a new job fast", "how to find a job quickly", "how to get a new job in 30 days", "job search plan for the next 30 days", "how to start a job search", "where do I start looking for a job", "I need to find a job before savings run out" (links to `/tools/layoff-runway`), "how to find a job while working full time".
- Owners: `/start/need-a-new-job` and `/topics/job-search-in-30-days`. Distinct from `/topics/job-search-strategy`, which owns the general strategy phrase.

**E. Performance trouble.**
- "put on a PIP", "performance improvement plan what to do", "PIP or fired", "should I quit during a PIP", "how to survive a PIP", "PIP severance", "asked to resign", "forced resignation", "constructive dismissal", "boss wants me to quit".
- Owner: `/topics/performance-improvement-plan` and `/topics/asked-to-resign`. `/topics/fired-vs-laid-off` links in.

### Tier 2: next

**F. Career pivot, deeper than the existing `/topics/career-pivot`.** "career change at 30/40/50", "is it too late to change careers", "how to change careers with no experience", "best careers to switch to", "what career is right for me", "what should I do with my life", "career change quiz", "transferable skills list", "career change resume", "career pivot examples", "pivot into AI roles". Origins (backlog item 7): teacher, nurse, lawyer, military, sales, finance to a target role. Owners: `/topics/career-change-at-40`, `/topics/career-change-no-experience`, `/topics/transferable-skills`, then `/topics/career-pivot/<from>-to-<to>`.

**G. The search itself is failing.** "applying to jobs but no response", "why am I not getting interviews", "ghosted after applying" (these three are owned by `/why-stuck`; add sections there before making new pages), "ghosted after interview", "rejected after final round", "overqualified for jobs", "ATS rejecting my resume" (partly owned by `/resources/gatekeeper`), "job search burnout", "job search depression", "age discrimination in hiring", "too old to get hired", "how many applications does it take to get a job". Owners: `/why-stuck` for the first three, new `/topics/ghosted-after-interview`, `/topics/overqualified`, `/topics/job-search-burnout`, `/topics/age-and-hiring`.

**H. The company is changing.** "layoff rumors at my company", "signs my company will lay people off" (owned by `/tools/layoff-risk-check`), "company announced layoffs am I next", "survivor guilt after layoffs", "layoff survivor what to do", "hiring freeze meaning", "acquisition what happens to my job" (owned by `/topics/acquisition-layoffs`), "should I take the buyout" (owned). New owners: `/topics/layoff-survivor`, `/topics/company-announced-layoffs`.

### Tier 3: money and local

- Money after a job loss: "mortgage help after job loss", "student loans after job loss", "credit card help unemployed", "Medicaid after layoff" (extends `/topics/benefits-after-layoff`), "side income and unemployment".
- Local: "free career counseling near me", "free resume help near me", "workforce center in [city]" (extends `/job-centers`).

### How each page is built

1. One owner page per phrase cluster, written first, then the phrases go into `keywords.ts` (the Rule below).
2. Titles 30-56 characters, descriptions 110-165, validated by `src/test/seo-keyword-map.test.ts`.
3. Plain, direct copy in the voice of the existing topics; no "world-class" claims. The page answers the question in the first screen, then ends on the Market Reality Assessment.
4. Legal and benefit claims name their source and "as of" date. Content for A, B and E gets a read-through before publishing.
5. New top-level route folders update `src/lib/app-top-level.ts` in the same change. These all sit under `/topics` and `/start`, so none should.
6. Each page fires its PostHog event for the primary action when it is built.

## Backlog v3 (2026-10-30): résumé and job search, against Indeed

Owner request: win on résumé and job search the way Indeed does. Indeed's search traffic comes from a few repeatable shapes. We copy the shapes we can answer with our own data and skip the ones that need volume we do not have (hourly postings, company reviews).

| Indeed shape | Example searches | Our answer | Status |
| --- | --- | --- | --- |
| Title + place job listings | "marketing director jobs in Atlanta", "controller jobs near me" | `/jobs/title/<title>` plus a city cut, `/places/<state>/city/<city>` | Title pages live; **title × city pages missing** |
| Salary by title and place | "project manager salary in Texas" | `/salaries/<title>` | Live by title; **state and city cuts missing** |
| Company pages | "[company] salaries", "[company] jobs" | `/employers/<slug>` | Live; reviews are out (no data we can stand behind) |
| Company interview questions | "[company] interview questions" | Not built | **Gap** |
| Résumé templates and examples by title | "project manager resume example", "accountant resume summary" | `/topics/resume-examples` only (one generic page) | **Biggest gap** |
| Cover letter examples by title | "marketing manager cover letter example" | `/topics/cover-letter-tips` only | **Gap** |
| Interview questions by title | "product manager interview questions" | `/topics/interview-questions-and-answers` only | **Gap** |
| Career guides | "how to become a [title]", "[title] job description" | Not built | **Gap** |
| Upload a résumé, get found | "post resume online" | `/submit-resume`, `/dossier` | Live |

### I. Résumé cluster (the largest build)

All of these are generated from data we hold (job postings, the skills matrix, salary rows), not written one page at a time by an LLM. Generated per-page LLM copy is metered spend and is flagged for approval before anything ships.
- **`/resume-examples/<title>`**, about 450 titles (the same set as `/salaries/<title>`). Phrases: "[title] resume example", "[title] resume sample", "[title] resume summary", "[title] resume skills", "[title] resume bullet points", "[title] resume template". Page body: the skills and tools that appear most often in open postings for that title, a summary and bullet pattern with the verbs and numbers that fit, and a link to `/tools/resume-check`. Owner of the phrase family; `/topics/resume-examples` becomes the hub.
- **`/cover-letter-examples/<title>`** for the top 100 titles: "[title] cover letter example", "[title] cover letter sample".
- **`/interview-questions/<title>`** for the top 100 titles: "[title] interview questions", "[title] interview questions and answers", "questions to ask in a [title] interview". Reuse `/tools/interview-answer-coach` as the call to action.
- **Résumé situations:** "resume for career change", "resume after being laid off" (owned), "resume with no degree", "resume for over 50", "resume for a promotion", "resume for a federal job", "federal resume format", "resume for returning to work" (extends `/start/returning`), "one page or two page resume", "resume font and margins", "resume keywords for [function]", "how to list a layoff on a resume", "how to list contract work", "how to list a promotion", "how far back should a resume go".
- **Tool pages:** "resume checker" (owned), "resume keyword scanner", "resume to job description match", "ATS score" (extend `/tools/resume-check`), "resume summary generator", "LinkedIn headline generator", "LinkedIn summary examples", "cover letter generator". Each is a page of its own; any that call an LLM per use is a cost decision first.

### II. Job search cluster

- **Title × city job pages** for titles with real openings in a city: "[title] jobs in [city]", "[title] jobs near me", "remote [title] jobs". Thresholds as for `job-title-rules.ts`; below the threshold the page redirects to the title page, so there are no thin pages.
- **Salary × place:** `/salaries/<title>/<state>` first, city only where the sample is large enough. "[title] salary in [state]", "[title] salary in [city]", "how much does a [title] make in [state]".
- **Job descriptions and career guides:** "[title] job description", "[title] duties and responsibilities", "how to become a [title]", "[title] career path", "[title] skills", "[title] vs [title]", "what does a [title] do". From the same posting data. This is Indeed's career-guide pull.
- **Company interview and hiring pages:** "[company] interview questions" and "[company] hiring process" for employers with enough open jobs, built from our job and layoff data only (what they hire, how many, what they pay, whether they are cutting), never from scraped reviews.
- **Job search how-to (high intent):** "how to find a job", "how to find a job in a new city", "how to find remote jobs", "best job sites for professionals", "best job search sites 2026", "Indeed vs LinkedIn", "Indeed alternatives", "how to spot a fake job posting" (owned), "how to apply to a job", "how to follow up after applying", "how to ask for a referral", "recruiter reached out what to say".
- **Brand-comparison pages** (searchers already looking for an alternative): "Indeed alternatives for professionals", "LinkedIn alternatives", "job sites without ghost jobs", "job boards with salary listed". Factual only, no claims about competitors we cannot document.
- **What makes us different, stated on these pages:** jobs from the employer's own career site, salary shown, professional roles only, and the employer's layoff and hiring signal next to the posting. That is what the page copy leads with.

## Backlog v3 (2026-10-30): tools

Existing tools: AI job check, severance calculator, unemployment estimator, layoff runway, layoff deadlines, COBRA vs ACA, layoff risk check, job loss readiness, résumé check, bullet rewriter, interview answer coach, pay check, salary converter, WARN checker. Tool pages earn links and repeat visits, and each one has an owner phrase set in `keywords.ts`. Next tools, by search intent:

1. **Take-home pay calculator after layoff / severance net** (extends the severance calculator; "paycheck calculator by state").
2. **Unemployment vs severance vs new job comparison.**
3. **Résumé keyword match** (paste résumé and a job description; no LLM needed, a term-overlap score).
4. **Job offer comparison** and **offer negotiation script** ("is this job offer fair" is owned by `/topics/is-this-salary-fair`).
5. **Cost-of-living comparison** between cities (extends `/places`).
6. **Career change quiz** ("what career is right for me"), feeding the pivot pages.
7. **Notice period and PTO payout by state**, **final paycheck by state** ("when is my final paycheck due in [state]"), a high-intent, state-by-state family from sourced rules.
8. **Healthcare cost estimator after job loss** (extends COBRA vs ACA).
9. **Layoff letter explainer** (paste a RIF or severance letter, get a plain list of the deadlines and the questions to ask) — a strong owner for the RIF cluster and a clear path into the product. Uses no LLM if it matches known clauses; any LLM call goes to the cost decision first.

## Backlog v3 (2026-10-30): page tagging and structured data

"Tagging" means three things here, all required for every new page family.

**1. Structured data (JSON-LD) by page type.** `src/lib/seo/jsonld.ts` and the page-level `StructuredData` already cover breadcrumbs, FAQ and WebApplication markup (checked on the unemployment, layoff and tool pages). Audit the other families and fill the gaps:
- Job pages: `JobPosting` with `validThrough`, `baseSalary`, `hiringOrganization`, `jobLocation` and `directApply` where true. Confirm in the Rich Results test and the Search Console job posting report after the next deploy.
- Salary pages: `Occupation` with `estimatedSalary`. Employer pages: `Organization`. Guides: `Article` with named `author` (`authors.ts`), `datePublished` and `dateModified`. Layoff and data pages: `Dataset` with a download link.
- Tools: `WebApplication` (live on the estimator; add to the rest). Lists: `ItemList`. Every page: `BreadcrumbList`.
- Google shows FAQ rich results for very few sites now and has dropped HowTo, so keep `FAQPage` where the page has real questions, but as machine-readable structure for AI answer engines, not as a promise of a search-result feature.

**2. Visible freshness and source tags.** Every page shows "Updated <date>" and a "Sources" line naming the agency or dataset, and `dateModified` in the markup matches the visible date. Apply the bar in `seo-topic-quality.test.ts` to the new families so a page without sources fails CI.

**3. Analytics tags per page.** Give every page two PostHog properties from `keywords.ts`: `seo_cluster` (the cluster id) and `page_family`. Add them in the pageview call so the conversion from search visit to Market Reality Assessment can be read by cluster, which is how we decide where to build more. The primary-action event on each page keeps the rule in CLAUDE.md (specific `snake_case` name, with IDs).

Also: one canonical per page (`canonical.ts`), every new family in a dated sitemap and in the IndexNow ping, and `noindex` plus a redirect for any page under its thin-page bar.

## Backlog v3 (2026-10-30): AI and LLM search visibility

Live already: `llms.txt` (topic sections) and `llms-full.txt`, an allow-list in `robots.ts` for GPTBot, OAI-SearchBot, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, CCBot and Applebot, an MCP page, downloadable datasets under `/data`, a citations page for the labor-market data (`/press`), and an earlier citation check in `~/nc-ai-citations`. Next:

1. **Answer-first openings.** Every page puts a 40 to 60 word direct answer to its primary question in the first paragraph, then a short table or list. Answer engines lift that block.
2. **Quotable facts with a source and a date** ("Ohio pays up to $624 a week, as of July 1, 2026"), kept in one place per fact (`facts.ts`, `topic-facts.ts`) so the number is the same everywhere it appears.
3. **Definition pages** for terms people ask an assistant: RIF, WARN notice, severance, COBRA, garden leave, PIP, constructive dismissal, quiet quitting. The glossary has several; give the high-intent ones their own page and mark them `DefinedTerm`.
4. **Entity consistency.** The same name, description and `sameAs` links for the organization and for the named authors on every page; one "About the data" page that says where each dataset comes from.
5. **Comparison and "best of" pages** that assistants cite for "best job sites for executives", "best way to look for a job after a layoff": factual tables, dated, with the criteria stated.
6. **Track it.** Re-run the citation check monthly on a fixed list of about 60 questions (RIF, unemployment, layoffs, résumé, job search) and record which pages are cited by which assistant. Report it with the Search Console numbers.
7. Keep the allow-list; do not rate-limit the answer-engine crawlers.

## Backlog v3 (2026-10-30): where the keywords come from

Free sources only. A paid keyword tool is a recurring cost and gets approval first.
- Search Console queries and the pages they land on (the largest source of truth; the 2026-11-09 re-read is the next checkpoint).
- Google Keyword Planner (free with an Ads account) for volume bands on each cluster before building.
- Autocomplete and "People also ask" for each seed phrase, pulled politely: one request at a time, with a pause.
- Questions people ask in public job and layoff forums, and the questions that arrive in the Help inbox and in the product (what people type into search and the assistant), mapped to clusters.
- Our own data: the most common required skills in postings (résumé pages), the employers with the most notices (layoff pages), the titles with the most openings (job and salary pages).

## Rule

A phrase is added to `src/lib/seo/keywords.ts` only when its owner page exists, so the map never promises a page we do not have.
