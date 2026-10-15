# Louisville / Jefferson County: draft snapshot (not a report)

Snapshot of the `ExclusiveJobPosting` table, counted in the database on 2026-10-15 about 18:30 UTC. Draft for internal review. **The table was still growing while this was counted** (962 Louisville postings arrived in one hour at 16:00 UTC, 78% from Jooble), so these numbers will be out of date within hours.

Frame: **mid-level and above only.** The feed contains no entry-level or hourly postings, so there is no all-jobs frame yet. Louisville, Colorado and Louisville, Nebraska rows are excluded. Archived rows are excluded.

## Size and sources

| | |
|---|---|
| Louisville-area postings | 1,863 |
| Distinct employers | 1,062 |
| From the Jooble aggregator | 1,459 (78%) |
| Manager level and above | 1,565 (84%) |
| Mid-level individual contributor | 298 (16%) |
| With stated pay | 448 (24%) |
| Average stated minimum pay (all levels in feed) | about $111,000 (manager and above $113,700; mid-level IC $98,900) |

Stated pay covers a quarter of postings, so the averages describe only those.

## Employers: one job or many

| Postings per employer | Employers | Postings |
|---|---|---|
| 1 | 793 | 793 |
| 2-5 | 231 | 579 |
| 6-20 | 34 | 322 |
| 21 or more | 4 | 169 |

75% of employers have a single posting; the 38 employers with 6 or more hold 26% of postings.

## Function (keyword match on title, rough)

| Function | Postings | Mention AI | Average stated minimum pay |
|---|---|---|---|
| Engineering, data, IT | 388 | 21 (5.4%) | $123,350 |
| Finance, accounting | 295 | 8 (2.7%) | $110,451 |
| Operations, projects | 223 | 3 (1.3%) | $109,363 |
| Sales, marketing | 149 | 3 (2.0%) | $118,205 |
| Healthcare, clinical | 68 | 1 (1.5%) | $147,839 |
| Legal | 64 | 0 | $122,070 |
| HR, recruiting | 64 | 0 | $93,982 |
| Other | 612 | 17 (2.8%) | $102,528 |

## Text signals (share of the 1,863 postings; **undercounts**, see caveat)

| Signal | Postings | Share |
|---|---|---|
| Mentions AI (AI, machine learning, generative, LLM, copilot) | 54 | 2.9% |
| Remote | 86 | 4.6% |
| Hybrid | 46 | 2.5% |
| On-site | 64 | 3.4% |
| Names a 401(k) | 14 | 0.8% |
| Names health insurance | 10 | 0.5% |
| Names paid time off | 20 | 1.1% |
| Leadership | 203 | 10.9% |
| Teamwork or collaboration | 134 | 7.2% |
| Creativity or innovation | 114 | 6.1% |
| Communication | 64 | 3.4% |
| Empathy, emotional intelligence, adaptability | 8 | 0.4% |
| "Fast-paced" or similar intensity language | 21 | 1.1% |
| Work-life balance or flexibility | 9 | 0.5% |
| Evergreen language ("talent pool", "always hiring") | 0 | 0% |

**Caveat.** Aggregator descriptions are often short snippets, not the full posting. Remote, benefits and skills signals are therefore lower bounds, and the AI share by itself says little. Do not publish any of these rates until the direct-from-employer crawl supplies full text.

## Coverage gaps, re-checked against the current data

Large employers with still no or almost no Louisville postings: Kroger 0, Louisville Metro Government 0, Commonwealth of Kentucky 0, Wells Fargo 0, Jefferson County Public Schools 1, Walmart 1, UPS 2, Ford 2, Lowe's and Home Depot 1 combined. Better than before: Norton 26 (was 7), Humana 52, Amazon 5, University of Louisville 6, Texas Roadhouse 3.

## Layoffs (WARN, Jefferson County)

8 notices covering 779 employees since April 2026; 411 in the last 90 days. One notice has a future date (2026-12-08) and needs correcting. WARN covers all levels and is not comparable with this mid-level-and-above feed.

## What this snapshot cannot say

- Anything about the all-jobs frame, entry-level or hourly hiring.
- Anything about reposts, old jobs or ghost risk (no first-seen history in this table).
- Anything about month-over-month change (the table is in its first weeks).
- Market share: no published metro openings count exists.

## Next

The direct employer, public-sector and staffing crawls (see `crawler-handoff.md`) are needed to reach 50% coverage and to supply full text. This session's network policy blocks the job sites, so the crawl has to run where the crawler lives or the environment's network access has to be widened.
