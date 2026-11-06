# Methodology note: margins of error on the long-search comparisons

*October 2026 White Collar Employment Report. Reproducible with `scripts/employment-report/gvf-long-search-margins.py`.*

## What is being compared
For each group, the share of unemployed people who have been unemployed 27 weeks or more (spells in progress), pooled over January to September 2026 and compared with the same months of 2025. Weights are the CPS composite weights. Not seasonally adjusted. The counts of records behind each group are unweighted person-month observations: the CPS follows households for several months, so one person can appear more than once.

## Method 1 (primary): BLS generalized variance functions
Parameters are from BLS's published "Parameters and factors for calculating standard errors for estimates from the Current Population Survey", table PF-12, percent distribution, "27 weeks and over": alpha = 3790.63896835, beta = -1.4058504e-05. Factors: quarterly averages 0.7244570082; yearly averages 0.4135866746; change in consecutive yearly averages 0.5546751680.

1. Base y = the group's average monthly number of unemployed people (persons), estimated from the weighted data.
2. Standard error of the percentage p (0 to 100) for a single month: se = sqrt(((alpha + beta x y) / y) x p x (100 - p)).
3. Factor for a nine-month average: linear interpolation between the three-month and twelve-month factors, f9 = fq + (fy - fq) x (9 - 3) / (12 - 3) = 0.5172.
4. Factor for the year-over-year change of nine-month averages: f9 x (change-in-yearly factor / yearly factor) = 0.5172 x 1.3411 = 0.6936.
5. Standard error of the change = 0.6936 x se; 90% margin of error = 1.645 x that.

How overlap between months and years is handled: BLS builds the published factors for averages and for changes from the CPS rotation design, which includes the repeated observation of households across consecutive months and in the same month a year apart. We apply BLS's published ratio instead of estimating covariances ourselves. We do not recompute those covariances from the public microdata, because Census does not release replicate weights for the public monthly files.

Limits: the nine-month factor is an interpolation, not a published value; and for subgroups (knowledge workers, white-collar without a bachelor's, ages 55 to 64, blue-collar) we use the parameters for all unemployed people, because BLS does not publish parameters for those cuts. That can understate variance for small groups. Check: the same method reproduces the September edition's published margins (white-collar 27+ weeks, +5.3 points: plus or minus 2.3 here for January to September against 2.4 for January to August; ages 55 to 64: 6.1 against 6.3).

## Method 2 (conservative check)
Treat the two years as independent samples of unemployed person-month observations, apply a design effect of 2.0, and count the pooled months as 40% independent. Margin = 1.645 x sqrt(5 x (p1(1-p1)/n1 + p2(1-p2)/n2)). This ignores the positive covariance between years, so it overstates the margin of the change.

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

## Not covered
Month-to-month changes, the Long-Search Index margin (about 11% of the three-month level, as published in the September edition), and medians, for which BLS publishes no parameters in the table used here.
