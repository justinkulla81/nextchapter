# Methodology note: margins of error on the long-search comparisons

*October 2026 White Collar Employment Report. Reproducible with `scripts/employment-report/gvf-long-search-margins.py`.*

## Validation against BLS
As a check on the CPS pipeline, we computed all-worker figures from the microdata and compared them with BLS-published, not seasonally adjusted series for the same months (BLS series LNU01000000, LNU03000000, LNU03008636; ratio of January to September sums).

| Measure | Period | This pipeline | BLS | Difference |
|---|---|---:|---:|---:|
| Unemployment rate (%) | Jan-Sep 2026 | 4.32 | 4.32 | 0.00 |
| Unemployment rate (%) | Jan-Sep 2025 | 4.30 | 4.30 | 0.00 |
| Share of unemployed out 27+ weeks (%) | Jan-Sep 2026 | 25.8 | 25.9 | -0.1 |
| Share of unemployed out 27+ weeks (%) | Jan-Sep 2025 | 22.7 | 22.6 | +0.1 |
| Unemployed 27+ weeks (thousands, monthly average) | Jan-Sep 2026 | 1,900 | 1,900 | 0 |
| Unemployed 27+ weeks (thousands, monthly average) | Jan-Sep 2025 | 1,663 | 1,659 | +4 |

The white-collar, knowledge-worker and other cuts use the same code and weights; BLS does not publish them, so they cannot be checked this way.

## What is being compared
For each group, the share of unemployed people who have been unemployed 27 weeks or more (spells in progress), pooled over January to September 2026 and compared with the same months of 2025. Weights are the CPS composite weights. Not seasonally adjusted. The counts of records behind each group are unweighted person-month observations: the CPS follows households for several months, so one person can appear more than once.

## How the nine months are pooled
The share is a ratio of weighted sums, not an average of monthly percentages: the numerator is the sum, over January to September, of the weighted count of unemployed people out 27 weeks or more; the denominator is the sum of the weighted count of all unemployed people. The same is done for 2025. Weights are the CPS composite weights (PWCMPWGT); durations are top-coded at 119 weeks and are spells in progress.

## Method 1 (primary): BLS generalized variance functions
Parameters are from BLS's published "Parameters and factors for calculating standard errors for estimates from the Current Population Survey", table PF-12, percent distribution, "27 weeks and over": alpha = 3790.63896835, beta = -1.4058504e-05. Factors: quarterly averages 0.7244570082; yearly averages 0.4135866746; change in consecutive yearly averages 0.5546751680.

1. Base y = the group's average monthly number of unemployed people (persons), estimated from the weighted data.
2. Standard error of the percentage p (0 to 100) for a single month: se = sqrt(((alpha + beta x y) / y) x p x (100 - p)).
3. Factor for a nine-month average: linear interpolation between the three-month and twelve-month factors, f9 = fq + (fy - fq) x (9 - 3) / (12 - 3) = 0.5172.
4. Factor for the year-over-year change of nine-month averages: f9 x (change-in-yearly factor / yearly factor) = 0.5172 x 1.3411 = 0.6936.
5. Standard error of the change = 0.6936 x se; 90% margin of error = 1.645 x that.

How overlap between months and years is handled: BLS builds the published factors for averages and for changes from the CPS rotation design, which includes the repeated observation of households across consecutive months and in the same month a year apart. We apply BLS's published ratio instead of estimating covariances ourselves. We do not recompute those covariances from the public microdata, because Census does not release replicate weights for the public monthly files.

Limits: the nine-month factor is an interpolation, not a published value; and for subgroups (knowledge workers, white-collar without a bachelor's, ages 55 to 64, blue-collar) we use the parameters for all unemployed people, because BLS does not publish parameters for those cuts. That can understate variance for small groups. Check: the same method reproduces the September edition's published margins (white-collar 27+ weeks, +5.3 points: plus or minus 2.3 here for January to September against 2.4 for January to August; ages 55 to 64: 6.1 against 6.3).

### Worked example: white-collar workers, 27+ week share
Inputs: average monthly white-collar unemployed y = 1,933,000 persons; p = 28.5%.
- Single-month standard error: sqrt(((3790.639 + (-1.4058504e-05 x 1,933,000)) / 1,933,000) x 28.5 x 71.5) = 1.992 points.
- Factor for the change in nine-month averages: 0.6936 (see step 4).
- Standard error of the change: 0.6936 x 1.992 = 1.382; 90% margin: 1.645 x 1.382 = plus or minus 2.3 points. The observed change is +5.3 points.

## Method 2 (conservative check)
This is a sensitivity test, not a validated design-based estimate. The rule of thumb (design effect 2.0; pooled months counted as 40% independent, so eight months count as 3.2) was adopted in the September edition's first versions and has not been validated against replicate-weight estimates, which Census does not release for the public monthly files. Treat the two years as independent samples of unemployed person-month observations, apply a design effect of 2.0, and count the pooled months as 40% independent. Margin = 1.645 x sqrt(5 x (p1(1-p1)/n1 + p2(1-p2)/n2)); for white-collar workers, with n = 4,315 and 4,417 person-month observations and shares of 28.5% and 23.2%, that is plus or minus 3.4 points. This ignores the positive covariance between years, so it overstates the margin of the change.

## Results
| Group | Unemployed (thousands, monthly average) | Share out 27+ weeks, 2026 | 2025 | Change (points) | 90% margin, BLS method | 90% margin, conservative | Clears BLS | Clears conservative |
|---|---:|---:|---:|---:|---:|---:|---|---|
| All workers | 7,364 | 25.8% | 22.7% | +3.1 | ±1.1 | ±1.7 | yes | yes |
| Blue-collar | 1,714 | 22.7% | 19.8% | +2.9 | ±2.2 | ±3.4 | yes | no |
| White-collar | 1,933 | 28.5% | 23.2% | +5.3 | ±2.3 | ±3.4 | yes | yes |
| White-collar, no bachelor's | 633 | 26.4% | 20.2% | +6.2 | ±3.9 | ±5.7 | yes | yes |
| Knowledge workers | 1,297 | 29.6% | 24.8% | +4.8 | ±2.8 | ±4.3 | yes | yes |
| White-collar, ages 55-64 | 312 | 39.1% | 27.0% | +12.1 | ±6.1 | ±8.8 | yes | yes |

A change "clears" a margin when it is larger than that margin. Every change clears the BLS margin; blue-collar does not clear the conservative margin.

## Tests of differences between groups (version 1.3)
For the difference between two groups' changes (white-collar +5.3 against blue-collar +2.9; white-collar ages 55-64 +12.1 against all workers ages 55-64 +5.9) we take the square root of the sum of the two squared BLS-method margins, which treats the groups as independent. White-collar is part of "all workers", so independence is an approximation; the positive covariance would make the true margin somewhat smaller, but the white-collar share of unemployed people aged 55-64 is small enough that the approximation is close. Results: white-collar against blue-collar, difference 2.4 against about 3.2; ages 55-64, difference 6.2 against about 7.1; white-collar against all workers, difference 2.2 against about 2.5. None is distinguishable from zero. For the difference in levels (share out 27+ weeks, 2026), we use the BLS-method level margin for each group (nine-month factor 0.5172) and combine them the same way: white-collar 28.5% against blue-collar 22.7% (5.8 against about 2.4); white-collar ages 55-64 39.1% against all workers ages 55-64 30.5% (8.6 against about 5.3).

## Month-to-month flows (version 1.3)
Source: Census CPS public-use basic monthly files, January to September 2025 and 2026 (https://www2.census.gov/programs-surveys/cps/datasets/). A person is matched across consecutive months by household identifier (hrhhid, hrhhid2) and person line number (pulineno), requiring months in sample to advance by one, the same sex and an age change of 0 or 1. Eight month-to-month pairs per year (January to February through August to September), pooled; 428,738 matched people in 2025 and 414,826 in 2026. Weights are the month-t basic composite weight (PWCMPWGT); BLS's longitudinal weights are not on the public file, so levels are approximate and we compare years under the same method. Statistics: among people unemployed in month t, the share employed in month t+1 (exit rate); the same for those unemployed 27+ weeks; among people employed in month t (by occupation of the current job), the share unemployed in t+1 (entry rate). Margins: no BLS parameters exist for matched flows, so we use a conservative rule: design effect 2.0 and pooled transitions counted as 40% independent (effective sample = observations / 5), with the 90% margin on a difference = 1.645 x sqrt(se1^2 + se2^2). Results, 2026 against 2025 (white-collar): exit to employment 25.3% against 27.7% (-2.4, margin about 4.5); exit to employment among those out 27+ weeks 13.2% against 16.4% (-3.2, margin 7.3); entry from employment 0.63% against 0.71% (-0.08, margin 0.13). All workers: entry 0.86% against 0.97% (-0.11, margin 0.10). No white-collar change is distinguishable from zero. Code: scripts/employment-report/nc_cps_flows.py; results: cps-flows-jan-sep.json.

## Within-employer comparison of posted pay (version 1.3)
Open postings on NextChapter's board (same live rule as the employer rankings, one row per posting fingerprint, internships and search firms excluded, USD ranges of $30,000 to $1,000,000, November 7, 2026). A posting "names AI skills" if the crawler found at least one specific AI skill in the full posting text (aiSkillGroups; hand-checked precision about 86%). Across employers: median posted-range midpoint for AI-naming and other postings in each function-and-level cell with at least 30 of each kind (89 cells). Within employer: the same, by employer, function and level, for cells with at least three of each kind (306 cells, 144 employers); the log ratio of medians per cell, summarized by its median (+0.9%) and by its mean weighted by AI-naming postings (+3.9%). No standard errors are computed; the sign counts (159 up, 89 down, 58 equal) show the spread. SQL: scripts/employment-report/ai-skill-pay.sql.

## Employer-class check and exposure outcomes (version 1.4)
Employer-class check: the same live-board rule and posting-level pay as the within-employer comparison; an employer is "AI-asking" if at least five of its live deduplicated postings name an AI skill (2,292 of 57,648 employers with open jobs). Postings that do not name AI skills at those employers (27,702 with pay) are compared with postings at all other employers (56,780) in each function-and-level cell with at least 30 of each; 113 cells; median of cell log ratios +24.3%, 110 cells higher, middle half +17.2% to +31.3%. Employer size and location are not held fixed. SQL: scripts/employment-report/ai-skill-pay.sql.

Outcomes by AI exposure: observed exposure (Anthropic Economic Index, October 22, 2026 vintage) is averaged, unweighted, over the detailed occupations in each SOC major group and matched to the CPS detailed occupation recode (PRDTOCC1, 22 groups). Employment (thousands, monthly average), unemployment rate and share out 27+ weeks come from the January to September breakdowns for 2026 and 2025; group totals are sums of group employment and unemployed counts. No margins are computed for the group comparisons, and the share-out-27+-weeks change for computer and mathematical occupations (41.9% against 27.2%, +14.7 points) uses the BLS-method change margin (about 7.2) and the conservative rule (about 10.9). Code: scripts/employment-report/exposure-outcomes.py.

## Shifts, software and geography (version 1.5)
Indeed Hiring Lab (CC BY 4.0), github.com/hiring-lab/job_postings_tracker: US sector and metro postings indexes (seasonally adjusted, February 1, 2020 = 100), October 30, 2026 against October 31, 2025. Our grouping of 34 sectors into more and less exposed uses the Anthropic Economic Index score of the occupations each sector contains (computer and mathematical, legal, office and administrative, business and financial, sales, arts and media as more exposed; health care, personal care, construction, installation, transportation, food service, production, engineering and architecture as less); it is a judgment, listed in the sector data file. BLS payrolls: seasonally adjusted, October 2025 and October 2026 (preliminary), read from data.bls.gov series pages (health care CES6562000001, federal CES9091000001, construction CES2000000001, manufacturing CES3000000001, leisure and hospitality CES7000000001, retail CES4200000001, telecommunications CES5051700001, motion picture and sound CES5051200001, data processing CES5051800001, software publishers CES5051320001). CPS by Census division and state: same files, weights and white-collar definition as above; employment is the weighted monthly average of employed white-collar workers, unemployment rate and long-spell share as in the group tables; margins on the change in long-spell share use the conservative rule (effective n = n/5), shown only where each year has at least 100 unemployed observations; employment changes are not tested. Code: scripts/employment-report/nc_cps_geo.py; results: cps-geo-jan-sep.json. Our open-jobs snapshot (software titles by regular expression on the posting title; counts by state and share naming AI skills) is a one-day count with no trend, from the same deduplicated live-board rule as the employer rankings.

## AI-skill postings outside technology, and degree-holders by age (version 1.6)
AI-skill postings by employer industry: same live-board rule and deduplication as the employer rankings, joined to the employer's industry in NextChapter's company records (Company.industry; "Technology & Software" is treated as technology; employers with no industry label, 134,344 jobs, are counted outside it and may include technology firms). A job "names AI skills" if the crawler found at least one specific AI skill in the full text (aiSkillGroups; about 86% precision when hand-checked). November 8, 2026: 559,278 jobs, 58,659 naming an AI skill. Concentration: the largest employers by number of AI-naming jobs, within and outside technology. Run through a one-off read-only edge function (the database tool's 60-second limit); results in ai-ex-tech-totals.json, ai-ex-tech-by-function.json and the industry CSV in the data download.

Degree-holders by age: CPS public-use basic files, PEEDUCA 43 or more (bachelor's degree or more) against under 43, any occupation, by age band 22-27, 28-34, 35-44, 45-54, 55-64; unemployment rate and share of unemployed out 27+ weeks, January to September 2026 and 2025, PWCMPWGT; margin on the change in the long-spell share by the conservative rule (effective n = n/5), 90%. Rate differences are not tested. Code: scripts/employment-report/nc_cps_degree_age.py; results: cps-degree-age-jan-sep.json.

## Reason for unemployment and the matched-flow method (version 1.9)
Reason for unemployment: CPS PRUNTYPE (job loser on layoff, other job loser, temporary job ended, job leaver, re-entrant, new entrant), unemployed white-collar workers (occupation of the last job, so new entrants, who have none, are not in this group), January to September 2026 and 2025, PWCMPWGT; shares by reason and share out 27+ weeks within each reason; differences are not tested. Code: scripts/employment-report/nc_cps_reason.py; results: cps-reason-jan-sep.json. This addresses whether the rise in long spells reflects a shift toward retirees or voluntary leavers: the mix by reason is almost unchanged and the long-spell share rose within each reason.

Matched flows, plain language: the public CPS files identify the same person in consecutive months but do not include the longitudinal weights BLS uses for its published gross flows. We use each month's regular survey weight (PWCMPWGT) for the people we match, so flow levels are approximate and may differ from BLS's; we compare 2026 with 2025 under the same method. We have not yet validated the method against BLS's published gross-flow tables (the BLS flows pages could not be read in this review), and the margins use a conservative rule rather than a validated variance estimate. White-collar flow changes are not statistically distinguishable from zero; the all-worker entry-rate decline is.

Margin labels: all 90% margins on shares are NextChapter estimates that apply BLS's published generalized-variance parameters (with an interpolated nine-month factor and the parameters for all unemployed people applied to subgroups); they are not margins published by BLS. The conservative rule is a sensitivity calculation, not a validated second method.

## Not covered
Month-to-month flow margins other than those above, the Long-Search Index margin (about 11% of the three-month level, as published in the September edition), and medians, for which BLS publishes no parameters in the table used here.
