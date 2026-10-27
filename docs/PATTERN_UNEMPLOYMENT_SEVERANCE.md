# Unemployment and severance: demand, who ranks, our angle, sources

Written 2026-10-27 for the unemployment-and-severance cluster (the second use of the COBRA vs ACA pattern, PR 512). Everything below was read on that date.

## Demand evidence

Search Console shows almost nothing for us today besides the COBRA vs ACA cluster, so demand here is measured with Google autosuggest (`suggestqueries.google.com`, 30 seeds) and live results. Autosuggest shows what people type, not how many; it is evidence of shape, not volume.

**The state is the query.** The strongest pattern in the suggestions is a topic plus a state:

| Seed | What autosuggest returned |
|---|---|
| can i collect unemployment if i get severance | "in ny", "in nj", "pay in florida", "in illinois", "in massachusetts", "in pa" |
| does severance affect unemployment | "in california", "in illinois", "in washington state", "in texas", "in pa", "in ny" |
| severance vs unemployment | "ny", "texas", "california", "massachusetts" |
| how to file for unemployment in | ny, nj, ct, nyc, texas, florida |
| how much unemployment will i get | "in ny", "in nj", "if i make $1,000 a week" |
| unemployment benefits <state> | amount, how long, eligibility, requirements, login, phone number (Texas, California, Florida, New York) |
| maximum weekly unemployment | texas, california, illinois, missouri, washington, ohio |
| unemployment work search requirements | michigan, pa, nys |

**The severance questions people ask** (autosuggest): "is severance taxed" (at a higher rate, as a bonus, at the supplemental rate), "severance pay tax withholding" (also by state), "severance calculator after taxes", "how much severance should i get" (after 3, 4, 20 years), "do i have to sign a severance agreement", "how long do i have to sign a severance agreement", "severance agreement over 40", "lump sum vs salary continuation", "can you collect unemployment after severance ends", "cobra and unemployment".

**What we hold that others do not.** Our `src/lib/data/state-ui.ts` has, for all 50 states and DC, the maximum and minimum weekly benefit, weeks, waiting week, work-search rule, and how each state treats severance and pay in lieu of notice, every figure with its own source URL and date. How the 51 treat severance: 17 reduce benefits, 12 disqualify for the weeks the pay is treated as covering, 11 depend on how the payment is structured, 7 do not deduct it (CA, IL, KY, MO, OR, WA, WV), and 4 are unconfirmed (MS, MT, NY, RI: official sources disagreed). No consumer site publishes that count with sources for every state.

## Who ranks, and what they lack

Live results for "can i collect unemployment if i get severance in New York", "does severance affect unemployment in Texas", "severance calculator after taxes" and the OWBPA review-period question:

- **Law-firm blog posts and content-farm pages** (several are throwaway `.pages.dev` sites), plus consumer finance pages. They contradict each other: one New York answer cites a 2014 maximum benefit of $405, another $869, with no date; a Texas answer set splits between "no impact" and "no benefits while receiving severance".
- **State agencies rank for their own state** (for example the Texas Workforce Commission), accurate but one state and not written for a person deciding what to do this week.
- **Severance calculators** are generic: gross only, or a flat tax guess, and none connect the result to unemployment, COBRA or the deadlines in a severance agreement.

**Our angle.** One connected, dated, sourced answer for a person in the first week: what unemployment pays in your state, whether your severance affects it (with the state's own rule shown and linked), the clock for the severance agreement itself (21 or 45 days to review, 7 to revoke), the WARN notice rights, the 60-day COBRA and marketplace window (PR 512's pages), and one calculator that shows gross, the federal withholding we can source, and the assumptions. We say "check with the agency" where the sources disagree, instead of guessing.

## What this pull request builds

- `/unemployment-benefits/<state>`: an answer-first block on whether severance affects benefits in that state, a first-60-days timeline per state, a deadline email box and the laid-off journey hand-off. The existing pages already pass the thin-page bar (506 median words, 36 numbers, 0.60 maximum similarity, 20 of 20 sampled), so they are extended, not rewritten.
- `/unemployment-benefits`: a section grouping the 51 by how they treat severance, with a link to every state.
- `/resources/severance-pay`: an ungated explainer (no federal severance requirement, typical packages, taxes and withholding, the agreement-review rules, WARN, what to ask for, unemployment by state, FAQ).
- `/tools/severance-calculator`: gross range as before, plus the federal withholding and payroll taxes we can source, an optional state-rate input, a state selector that shows that state's unemployment rule, and the assumptions.
- Funnel offers table: one row for the unemployment pages and one for the severance pages.

## Sources

Read 2026-10-27 unless noted. The figures are in `src/lib/severance/rules.ts`; `src/test/severance-rules.test.ts` fails if a figure loses its source or date.

| Claim | Source | Detail |
|---|---|---|
| No federal law requires severance pay; it is a matter of agreement | DOL, Severance Pay: https://www.dol.gov/general/topic/wages/severancepay | "There is no requirement in the Fair Labor Standards Act (FLSA) for severance pay. Severance pay is a matter of agreement between an employer and an employee"; EBSA may assist an employee who did not receive severance benefits under an employer-sponsored plan |
| Severance is wages subject to Social Security, Medicare and federal income tax withholding | IRS Publication 15 (2026), Circular E: https://www.irs.gov/publications/p15 | "Severance payments are wages subject to social security and Medicare taxes, federal income tax withholding, and FUTA tax" |
| Flat withholding on supplemental wages: 22%, and 37% on supplemental wages over $1 million in the calendar year | same | "The withholding rate on supplemental wages remains 22%"; "37% if supplemental wages ... exceed $1 million" |
| Social Security tax 6.2% on wages up to $184,500 in 2026; Medicare 1.45% with no limit | same | |
| Additional Medicare Tax 0.9%; employers withhold it on pay over $200,000 in a calendar year | IRS Topic 560: https://www.irs.gov/taxtopics/tc560 | page reviewed 2026-10-09 |
| Unemployment compensation is taxable income | IRS Topic 418: https://www.irs.gov/taxtopics/tc418 | see docs/COBRA_VS_ACA_SOURCES.md |
| A waiver of age-discrimination claims must give at least 21 days to consider (45 days in a group exit incentive or termination program, with the decisional-unit disclosure), 7 days to revoke, and written advice to consult an attorney; the employee may sign earlier if knowing and voluntary | EEOC, Q&A: Understanding Waivers of Discrimination Claims in Employee Severance Agreements: https://www.eeoc.gov/laws/guidance/qa-understanding-waivers-discrimination-claims-employee-severance-agreements | issued 2009-07-15; the rule applies to employees 40 and older (Older Workers Benefit Protection Act, 29 U.S.C. 626(f)) |
| WARN: employers with 100 or more employees (not counting part-time) must give 60 days' written notice of a plant closing (50 or more lose jobs in 30 days) or a mass layoff (33% and at least 50, or 500 or more), to employees or their representative, the state rapid response unit and local government | 29 U.S.C. 2101 and 2102: https://www.law.cornell.edu/uscode/text/29/2101 and https://www.law.cornell.edu/uscode/text/29/2102 | |
| An employer that violates WARN owes each affected employee back pay for each day of violation, up to 60 days, plus benefits, reduced by wages and voluntary payments for the period; a court may reduce it for good faith | 29 U.S.C. 2104: https://www.law.cornell.edu/uscode/text/29/2104 | |
| Most common severance formula in one regional survey: one week per year of service (57%), then two weeks (24%) | ASE, 2024 Severance Pay, Policies, & Practices Survey (125 Michigan organizations), published 2024-02-15: https://www.aseonline.org/News-Events/Articles/ase-releases-results-to-the-2024-severance-pay-policies-practices-survey | Michigan employers only; not a national figure |
| Average total severance of 19.3 weeks in 2024 (15.6 the year before); individual contributors under 10 weeks; vice presidents and directors 15 to 25 weeks; C-suite 30 to 50 or more | Challenger, Gray & Christmas, 2025 Severance & Salary Benchmarking Report: https://www.challengergray.com/?p=27543 | "thousands" of packages; the page shows "Dec 30" without a year; a total length, not a per-year rate |
| How each state treats severance and pay in lieu of notice, weekly benefits, weeks, waiting week, work search, filing | `src/lib/data/state-ui.ts`, generated from DOL Significant Provisions (July 2026) and the DOL Comparison of State UI Laws (January 2023), and each state agency; every fact has a URL and date | see `docs/STATE_UI_REVERIFICATION.md` |

## Left out, and why

- **New York, Rhode Island, Mississippi and Montana severance rules.** The existing data marks them unconfirmed (official sources disagree). I tried the New York Department of Labor's claimant handbook, which lists separation pay as something that can reduce benefits and points to fact sheet P825, but the PDF refused automated access and I could not read the rules, so the pages keep saying "check with the agency" for these four. New York is the most-searched state in the suggestions; a person should read P825 and update `src/lib/data/state-ui.ts` through the yearly re-verification.
- **A pending New York bill on severance review periods** appeared in search results; its status could not be confirmed, so it is not mentioned.
- **State tax on severance and on unemployment benefits.** Not sourced here; the calculator takes the user's own state withholding rate and the pages say to check the state.
- **Typical severance by seniority nationally.** The two surveys above measure different things and neither is a national per-year figure; the page shows both with their limits and states that there is no official statistic.
- **Social Security Administration wage-base page and a DOL WARN fact page** refused automated access; the wage base comes from IRS Publication 15 and WARN from the statute.
