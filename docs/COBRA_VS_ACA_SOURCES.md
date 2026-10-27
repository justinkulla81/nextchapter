# COBRA vs ACA: sources

Every figure and rule on /resources/cobra-aca, its state pages and /tools/cobra-vs-aca-calculator comes from a row below. All pages were read on **2026-10-26** ("as of" below). Figures that change each year live in one place, `src/lib/cobra-aca/rules.ts` (and the per-state table in `src/lib/cobra-aca/states.ts`), each with its own `asOf` and source; update those files and this one together. `src/test/cobra-aca.test.ts` fails if a figure loses its source or its date.

A statement we could not source is not on the pages. See "Left out" at the end.

## COBRA

| Claim | Source | Quote or detail |
|---|---|---|
| Federal COBRA applies to group health plans of employers with 20 or more employees; some state "mini-COBRA" laws may cover smaller employers | DOL EBSA, COBRA FAQs for workers, Q3: http://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/resource-center/faqs/cobra-continuation-health-coverage-workers | "20 or more employees"; state laws may cover smaller employers |
| 60 days to elect COBRA, counted from the later of the date coverage ends or the date the election notice is provided | same, Q12 | "You have 60 days to enroll in COBRA" |
| 45 days after electing to make the first payment (it may cover more than one month) | same, Q12, Q21 | "you then have 45 days to make your first payment" |
| Up to 18 months of coverage after job loss or reduced hours | same, Q10 | 18 months |
| You usually pay the whole premium: your share, the employer's share, plus 2 percent | same, Q2 (and DOL topic page: up to 102% of the plan's cost, https://www.dol.gov/general/topic/health-plans/cobra) | "up to 102% of the cost to the plan" |
| COBRA coverage is retroactive to the day job-based coverage ended once you elect and pay | same, Q21 | "retroactive to the day you lost your job-based plan" |
| To use a Marketplace plan you must select one within 60 days of losing job-based coverage; tax credits or cost-sharing reductions may lower the cost | same, Q4 | |

## Marketplace special enrollment and open enrollment

| Claim | Source | Quote or detail |
|---|---|---|
| Losing job-based coverage, including COBRA, qualifies you for a Special Enrollment Period; 60 days after the loss (or up to 60 days before an expected loss) | HealthCare.gov, special enrollment period: https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/ and https://www.healthcare.gov/have-job-based-coverage/if-you-lose-job-based-coverage/ | "You have 60 days after losing your job-based health coverage to enroll in Marketplace coverage" |
| Enroll before the loss: the plan can start the first day of the month after you lose coverage. Enroll after the loss: it starts the first day of the month after you pick a plan | https://www.healthcare.gov/have-job-based-coverage/if-you-lose-job-based-coverage/ | example: lose coverage March 7, pick a plan by March 31, start April 1 |
| After you pick a plan you have 30 days to send documents proving why you qualify; you cannot use the coverage until it is confirmed and the first premium is paid | same | |
| When COBRA ends you have 60 days to enroll through a Special Enrollment Period. Cancelling COBRA yourself before it ends does not qualify | https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/ | "not if you voluntarily cancel it before it ends" |
| Open enrollment for 2027 coverage on HealthCare.gov: November 1 to January 15; enroll by December 15 for January 1, December 16 to January 15 for February 1. State-run marketplaces may set their own dates | https://www.healthcare.gov/quick-guide/dates-and-deadlines/ | Page read 2026-10-26 |
| Savings and eligibility are based on household size and your estimated income for the year you need coverage; report income changes | https://www.healthcare.gov/unemployed/ | |

## Premium tax credit rules

| Claim | Source | Detail |
|---|---|---|
| 2026 applicable percentage table: under 133% FPL 2.10%; 133-150% 3.14 to 4.19%; 150-200% 4.19 to 6.60%; 200-250% 6.60 to 8.44%; 250-300% 8.44 to 9.96%; 300-400% 9.96%. Required contribution percentage 9.96% | IRS Rev. Proc. 2025-25, section 3.01: https://www.irs.gov/pub/irs-drop/rp-25-25.pdf | Table is for taxable years beginning in 2026 and "not more than 400%" |
| 2027 table: under 133% 2.15%; 133-150% 3.23 to 4.3%; 150-200% 4.3 to 6.78%; 200-250% 6.78 to 8.66%; 250-300% 8.66 to 10.22%; 300-400% 10.22%. Required contribution percentage 10.22% | IRS Rev. Proc. 2026-26, sections 3.01 and 3.02: https://www.irs.gov/pub/irs-drop/rp-26-26.pdf | Published in Internal Revenue Bulletin 2026-31, July 27, 2026 |
| Household income must be no more than 400% of the federal poverty line. For tax years 2021 through 2025 Congress temporarily removed that cap | IRS, Questions and answers on the Premium Tax Credit: https://www.irs.gov/affordable-care-act/individuals-and-families/questions-and-answers-on-the-premium-tax-credit | The 2026 and 2027 tables above end at 400%; we found no enacted extension of the 2021-2025 rules as of 2026-10-26 |
| A year's credit uses the most recently published poverty guidelines as of the first day of open enrollment (so 2026 coverage uses the 2025 guidelines; 2027 coverage uses the 2026 guidelines) | IRS Q&A, Q7; HealthCare.gov glossary: https://www.healthcare.gov/glossary/federal-poverty-level-fpl/ | |
| Federal poverty guidelines, 48 states and DC: 2025 $15,650 plus $5,500 per additional person; 2026 $15,960 plus $5,680 | HealthCare.gov glossary (above); HHS ASPE https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines | |
| Alaska 2025 $19,550 plus $6,880; Hawaii 2025 $17,990 plus $6,330 | Federal Register 2025-01377: https://www.federalregister.gov/documents/2025/01/17/2025-01377/annual-update-of-the-hhs-poverty-guidelines | |
| Alaska 2026 $19,950 plus $7,100; Hawaii 2026 $18,360 plus $6,530 | HHS ASPE poverty guidelines (above) | |
| Household income for the credit is modified adjusted gross income, from the tax return | IRS Q&A, Q8 | |
| Unemployment compensation is taxable income that must be reported | IRS Tax Topic 418: https://www.irs.gov/taxtopics/tc418 | "you must include in income all unemployment compensation you receive" |
| Enrolling in an employer plan that is minimum essential coverage blocks the credit for Marketplace coverage; for COBRA you can decline it and may still qualify for the credit | IRS Q&A, Q19 and Q20 | The IRS page does not say in these words that enrolling in COBRA ends the credit for the same months. Our reading, stated on the pages as ours: COBRA is employer coverage, so enrolling in it generally means no credit for those months. |

## Medicaid

| Claim | Source | Detail |
|---|---|---|
| As of October 2026, 41 states including DC have adopted Medicaid expansion and 10 have not: AL, FL, GA, KS, MS, SC, TN, TX, WI, WY | KFF, Status of State Medicaid Expansion Decisions: https://www.kff.org/medicaid/status-of-state-medicaid-expansion-decisions/ | |
| Georgia and Wisconsin cover adults up to 100% FPL through waivers, so they have no coverage gap; Georgia's waiver has work requirements | KFF, How many uninsured are in the coverage gap: https://www.kff.org/medicaid/how-many-uninsured-are-in-the-coverage-gap-and-how-many-could-be-eligible-if-all-states-adopted-the-medicaid-expansion/ | |
| Expansion covers adults 19-64 with income up to 138% FPL, tested on monthly income | KFF (above) and https://www.healthcare.gov/medicaid-chip/medicaid-expansion-and-you/ | 138% of the 2026 guideline for one person is $22,025 a year |
| In states that have not expanded, adults below 100% FPL generally get neither Medicaid nor Marketplace credits (the coverage gap); credits start at 100% FPL | KFF (above) | |

## Marketplace type and premiums by state

| Claim | Source | Detail |
|---|---|---|
| Marketplace type per state for 2026 (21 state-based, 2 state-based on the federal platform, 28 federally facilitated; only Illinois changed type for 2026) | KFF, State Health Insurance Marketplace Types: https://www.kff.org/affordable-care-act/state-indicator/state-health-insurance-marketplace-types/ | No 2027 data on that page; where a state changes for 2027 the page can be out of date |
| Average monthly benchmark premium (second-lowest-cost silver, age 40, weighted by county plan selections), 2025 and 2026, every state and DC; national $497 (2025) and $625 (2026) | KFF, Marketplace Average Monthly Benchmark Premiums: https://www.kff.org/affordable-care-act/state-indicator/marketplace-average-benchmark-premiums/ | "KFF analysis of data from Healthcare.gov, state rate review websites, state plan finder tools, and state provided data"; may include non-EHB premiums; no update date shown on the page |
| Find a state's insurance department | NAIC, Insurance Departments: https://content.naic.org/state-insurance-departments | |

## Tool method (not a sourced fact)

The calculator reads the credit from the applicable percentage table above. Inside a band it moves the percentage in a straight line from the band's starting figure to its ending figure as income rises. The IRS Form 8962 instructions (Table 2) list the exact figure for each whole percent of the poverty line; we did not find a statement that the table is linear, so the tool says "estimate" and points to Form 8962 for the exact figure. The Marketplace premium is the person's own quote if they enter one, otherwise the state's KFF benchmark for a 40-year-old, labeled as a typical figure. Age is not an input: we found no source we could cite for the age rating curve, so the tool says benchmark premiums are for age 40 and that older and younger people pay different amounts. It does not model cost-sharing reductions, household members with different coverage, or state subsidies.

## Left out because we could not source it

- **State continuation ("mini-COBRA") rules by state.** Commercial summaries disagree (lengths, election windows, which states have no law), and we found no current NCSL or Georgetown table to cite. State pages say a smaller employer may be covered by a state law (DOL Q3) and link to the state's insurance department (NAIC directory). No state-by-state duration or cost is stated.
- **Typical COBRA premiums.** No public dataset by state. The tool asks for the person's own quote and the explainer shows only the DOL rule (up to 102% of the plan cost). A national average from the KFF Employer Health Benefits Survey could be added once cited.
- **Marketplace names, web addresses and special enrollment variations for state-run marketplaces.** The pages send people to https://www.healthcare.gov/marketplace-in-your-state/ instead.
- **Cost-sharing reductions, Medicaid work requirements timing, state-funded subsidies, and the status of any extension of the 2021-2025 credit rules.** Not modeled or asserted; the explainer says rules can change and links the IRS.
- **2027 Marketplace premiums.** Only 2025 and 2026 benchmark figures are published in the KFF table we cite.
