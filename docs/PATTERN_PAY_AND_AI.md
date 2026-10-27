# Pay and AI-skill pay premium: demand, angle and method

Written 2026-10-27 for the pay and AI-skill cluster (the same pattern as the COBRA vs ACA resource: sourced figures in one place, an ungated explainer, pages that pass the thin-page bar, a simple tool, a journey hand-off, an offers-table row). Every outside claim below has the page it was read on; claims we could not open at the primary source are marked.

## Demand evidence

Google autosuggest (`suggestqueries.google.com`, read 2026-10-27, US). A suggestion is a query people type, not a volume.

| Seed | Suggestions seen |
|---|---|
| `ai skills salary` | ai skills salary, ai skills salary increase, ai skills salary trends, **ai skills salary premium**, ai skills certification salary 2026, ai agent skills salary, ai skills job market salary, **ai skills non tech jobs salary** |
| `do ai skills increase salary` | the seed itself only (no extensions) |
| `how much do ai skills pay in marketing` | the seed itself only |
| `how much do ai jobs pay` | how much do ai training jobs pay, how much do entry level ai jobs pay, what is the average salary of artificial intelligence, how much do ai researchers make |
| `prompt engineer salary` | location variants (US, India, UK, UAE), entry level (fresher), monthly pay |
| `am i underpaid` | am i underpaid calculator, quiz, at work, for my job, hourly, reddit |

Read: "ai skills salary premium", "ai skills salary increase" and "ai skills non tech jobs salary" are real queries. "Am I underpaid" plus a calculator is a large, ready-made query family that the existing pay check already answers, so it gets the explainer's link and a clearer title on the tool.

Our own Search Console (3 months, web, screenshots from the owner 2026-10-26): "ai training programs for employees" shows 6 impressions and 0 clicks; there is no query for the premium or for "am i underpaid" yet. The ungated explainer does not exist, so that is expected.

## Who ranks, and what they lack

Search results read 2026-10-27 for "AI skills salary premium job postings 2026" and "am i underpaid calculator":

- **PwC 2026 Global AI Jobs Barometer** (press release, 2026-06-15): reported by secondary coverage as a 62% average wage premium (57% the year before) from more than one billion job ads in 27 countries; up to 118% in some sectors and 16% in government. We could not open PwC's own pages (HTTP 403 on 2026-10-27), so **we do not quote the figure on the site**. Secondary coverage disagrees on the earlier years.
- **Lightcast, "Beyond the Buzz"** (press release 2025-07-23, https://lightcast.io/resources/blog/beyond-the-buzz-press-release-2025-07-23; report https://lightcast.io/resources/research/beyond-the-buzz-developing-the-ai-skills-employers-actually-need): postings that list AI skills offer 28% more, about $18,000 a year, across more than 1.3 billion postings; over half of AI-skill postings are outside IT (51%). The 28% is across the whole market, not a non-IT figure. Already on /ai-skills.
- **Vendor blogs and recruiters** (Robert Walters, Rework, Success, theinterviewguys): recycle the two figures above.
- **"Am I underpaid" calculators:** tools that compare a salary with market data (CareerCheck, Gerald, Product Hunt launches), minimum-wage underpayment checkers, BLS for official medians. Their data is modelled or survey-based.
- **Salary pages:** Glassdoor, Indeed, Levels.fyi, Payscale, hackajob and SEEK (advertised ranges for a single board).

What none of them show, and we hold: **current advertised pay read from live postings on employers' own career sites, in the United States, split by function, level, industry and state, with the AI-skill premium compared like for like and the sample sizes printed.** Global-ad studies give one headline number. Ours gives the table and the method, and it refreshes daily (cron `/api/cron/ai-market`).

## The winning angle

"Listings that ask for an AI skill advertise X% more, by function, with the sample sizes and the limits" (an explainer a journalist can cite, with the CSV), plus one block on each salary page where the data supports it, plus the existing pay check extended: your pay against what employers advertise for your title, and what the middle half of listings ask for.

We never claim causation. The number is a difference in advertised pay between postings, not what any person is paid or would be paid after learning a skill. The page says so.

## Method (how every number is computed)

The numbers come from the weekly snapshot `AiMarketSnapshot`, built by `src/lib/skills/ai-market-live.ts` (method in `src/lib/skills/ai-market.ts`):

- **Postings:** live board postings (approved, not archived, not expired, not an internship) whose AI fields were read from a full description (`aiBasis` full or twin). Excerpt-only postings are not used.
- **AI side:** the posting asks for a specific AI skill (`aiSkillGroups` not empty). **Baseline side:** no AI mention anywhere in the full text (`aiMention` false). Postings that mention AI without naming a skill are in neither side. "AI-skill" and "AI-exposed" are different counts and are never blended.
- **Pay:** the annualized midpoint of a range the employer posted (or stated in the text); board-listed and estimated pay are left out; hourly x 2,080.
- **Raw premium:** median pay of the AI side over median pay of the baseline side, minus 1. **Like for like:** within cells of the same function x level x industry that have 30 or more paid postings on both sides, the median log-ratio weighted by the AI side's count.
- **Minimums:** nothing is shown from fewer than 30 paid postings on either side (`MIN_PER_SIDE`); like for like needs 50 or more AI postings across cells (`MIN_LIKE_N`); a state, industry or level row needs 300 analyzed postings (`MIN_GROUP_POSTINGS`).

On a salary page the premium is the one for the title's **function** (the function most of that title's listings are tagged with, at least 60% of tagged listings and at least 10 tagged listings), not a per-title number. A per-title premium would almost never reach 30 paid postings on both sides, so we do not show one. The block says "for <function> roles in general".

Figures in the snapshot on 2026-10-27 (computed 2026-10-26): 287,725 live postings read from full text, of which 48,431 name an AI skill; overall raw premium 44.7% ($60,500) and like for like 16.9% ($28,000) from 12,214 AI and 16,496 baseline paid postings.

## Left out, on purpose

- A per-title AI premium (sample too small).
- The PwC figure (primary page not readable).
- Salary-by-metro: the existing job-title scan has the state, not a metro we can trust at the bars; the state table on each salary page stays as is.
- A causal or "you will earn" claim anywhere.
- No email switch is turned on. The pay-check result email stays behind `PAY_CHECK_EMAIL` (off); the explainer's signup is the newsletter list, which sends nothing by itself.
