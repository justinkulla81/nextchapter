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

## Rule

A phrase is added to `src/lib/seo/keywords.ts` only when its owner page exists, so the map never promises a page we do not have.
