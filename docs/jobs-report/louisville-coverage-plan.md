# Louisville / Jefferson County: coverage plan

Status: draft, 2026-10-15. Companion to `docs/specs/NextChapter_Jobs_Report_Spec.md`.

## Where we are

Counts come from the `ExclusiveJobPosting` table (the imported feed), not the full crawl database, as of 2026-10-15.

- A text match on "louisville" returns 815 rows. That overstates Kentucky: 74 are Louisville, Colorado (IonQ, Infleqtion and others), 1 is another state, and 44 have an unclear location string. **About 735 are Louisville, Kentucky** (695 clear plus roughly 40 unclear that read as Kentucky).
- 518 of the 815 rows (64%) come from the Jooble aggregator. The rest come from employer career sites. The `source` field says `ats_feed` for all rows, so it does not separate the two. Add a field that does.
- Level mix (Oct 15 snapshot): 16% mid-level individual contributors, 21% senior individual contributors, 42% managers, 21% senior managers and above. So 84% are senior individual contributor roles or above and 63% are manager level or above. An earlier note in this file and in chat that said 73% and 90% "manager or above" was wrong; it grouped senior individual contributors with managers.
- Location strings are inconsistent ("Louisville", "KY - Louisville", "HQ_Louisville", store codes, multi-site lists), so any geography report needs a normalized county code, not text matching.

## Denominators (all approximate; none is a metro openings count)

| Quantity | Value | Source |
|---|---|---|
| Louisville metro nonfarm jobs | about 702,000 (Jan 2026) | BLS |
| Kentucky job openings | 88,000 (Dec 2025; latest found) | BLS JOLTS |
| Estimated metro openings | about 25,000-30,000 | Our estimate: metro share of state jobs applied to state openings |
| Estimated white-collar share of employment | about 20% | FRED/HUD sector sums |

The estimated share of all openings that our Kentucky postings represent is about 2-3%. There is no published metro openings number, so the real denominator has to come from the coverage measurements below.

## Targets

- All-jobs frame: first target 50% of estimated openings, measured by the sample method below. This is the harder frame because hourly retail, food service and logistics hiring is a large share of openings.
- Mid-level-and-above frame: first target 50%. More reachable through direct employer crawls plus aggregators.

## How to measure coverage (both are needed)

1. **Employer coverage.** Share of Jefferson County employment working for employers whose career sites are crawled directly. Computed from `louisville-employer-targets.csv` once sizes are filled from QCEW or employer disclosures.
2. **Opening coverage.** Draw a random sample of postings from an independent source (for example, employers' own sites, picked at random from the county employer list), check which are in our data, and report the matched share with an interval. Repeat monthly.

## Gap analysis (see `louisville-employer-targets.csv`)

Large employers with **no postings** in our data: UPS, Kroger, JCPS, Louisville Metro Government, Louisville Water, MSD, Wells Fargo, Texas Roadhouse, Dinsmore, Bellarmine, Spalding, JCTC, Amazon, Walmart, Lowe's/Home Depot.

Large employers with **few postings** relative to their size: Ford (2), Norton (7), University of Louisville (1), Commonwealth of Kentucky (1), PNC (3), Fifth Third (2), JPMorgan (2).

Present from direct sources, worth confirming completeness: Humana, UofL Health, Baptist Health, Brown-Forman, LG&E and KU (PPL), Elevance, Papa John's, BrightSpring, ScionHealth.

Employer headcounts in the CSV are only filled where a source was found. Most are blank, and the figures that exist are old (2016 to 2022). Fill them from QCEW and employer disclosures before using them for weighting.

## Build order for coverage

1. Direct crawls for the zero and low rows above, starting with the largest employers.
2. Public sector: NEOGOV/governmentjobs for Louisville Metro, JCPS, the state and UofL; USAJOBS API filtered to Jefferson County.
3. Staffing firms and recruiter boards.
4. A second and third aggregator for small employers, with cross-source deduplication.
5. Location normalization to county code and metro membership (Jefferson County plus Southern Indiana counties of the Louisville metro).
6. Keep entry-level and hourly postings and store the level, so the all-jobs frame exists.

## Open items

- Confirm headcounts and Louisville presence for employers marked "verify".
- Correct one WARN notice dated 2026-12-08 (a future date) in the `WarnNotice` table before any layoff figure is used.
- Indiana WARN notices (218 rows) need filtering to the Southern Indiana counties in the metro.
