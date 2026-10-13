/**
 * Open data and methodology: the facts about the Displacement Report's public
 * replication repository, in one place for the public page and for pitch
 * leave-behinds.
 *
 * Mirrors README.md in the replication repository
 * (github.com/justinkulla81/nextchapter-displacement-report, public, checked
 * 2026-10-13). When the README changes, change this file.
 */

export const REPLICATION_REPO_URL = 'https://github.com/justinkulla81/nextchapter-displacement-report'
export const REPLICATION_PAGE_PATH = '/reports/replication'
export const OPEN_DATA_PAGE_PATH = '/reports/replication#open-data'

export const OPEN_DATA_LICENSES = {
  code: 'MIT License',
  data: 'CC BY 4.0 (attribute "NextChapter Displacement Report")',
} as const

/** The scripts, in the order the README runs them, with what each produces. */
export const OPEN_DATA_SCRIPTS: { file: string; produces: string }[] = [
  { file: 'code/01_wc_index_monthly.py', produces: 'White-Collar Long-Term Unemployment Index, monthly 2015 to 2026 (data/wc-index.csv)' },
  { file: 'code/02_cps_breakdowns.py, code/03_cps_aggregates.py', produces: 'Breakdowns by occupation, industry, age; older workers; graduates; blue-collar' },
  { file: 'code/04_margins_of_error.py', produces: '90% margins of error by the BLS generalized variance method' },
  { file: 'code/05_seasonal_sensitivity.py, code/x13_wcltu.spc', produces: 'Seasonal-adjustment robustness: fixed factors, X-13ARIMA-SEATS, STL, 12-month average' },
  { file: 'code/08_industry_productivity.py', produces: 'Industry productivity versus long searches' },
  { file: 'code/09_nativity_and_age_standardization.py', produces: 'Nativity breakdown; age-sex standardized 55+ participation' },
  { file: 'code/10_hidden_displacement.py', produces: 'Beyond-unemployment white-collar panel' },
  { file: 'code/11_exposure_vs_outcomes.py', produces: 'AI exposure versus outcomes by occupation, including the customer service test' },
  { file: 'code/12_education_experience.py', produces: 'Education and experience breakdowns' },
  { file: 'code/13_tfp_decomposition.md', produces: 'Total factor productivity decomposition from the SF Fed quarterly series' },
]

/** Stated as the repository README states them. */
export const OPEN_DATA_LIMITATIONS: string[] = [
  'Margins of error use BLS generalized variance functions because Census does not publish replicate weights for the public-use monthly files. These can understate variance for small groups.',
  'Eight-month average seasonal factors are interpolated between published 3- and 12-month factors.',
  'CPS occupation codes changed in 2020, so the index treats January 2020 as a potential break.',
  'The SEC restructuring-filing coding was done by one analyst. There is no second-coder reliability check yet.',
  'The revenue-per-employee sample is limited to companies whose 10-Ks state comparable total headcount. Figures are nominal and acquisitions are flagged, not adjusted.',
  'The senior openings tracker is a pilot and needs the NextChapter jobs database, so it cannot be reproduced externally.',
]

/** Not redistributed; the scripts fetch it. */
export const OPEN_DATA_SOURCES: string[] = [
  'U.S. Census Bureau Current Population Survey basic monthly public-use microdata (api.census.gov, free key)',
  'BLS parameters and factors for CPS standard errors',
  'Federal Reserve Bank of San Francisco quarterly TFP series (Fernald)',
  'SEC EDGAR full-text search and filing archives',
]

/**
 * Leave-behind for a pitch deck, email footer or one-pager. Short, plain,
 * every claim checkable on the repository page.
 */
export const OPEN_DATA_LEAVE_BEHIND = {
  title: 'Check our numbers',
  lines: [
    'The code and data behind the NextChapter Displacement Report are public.',
    'Code is MIT licensed. Data and documentation are CC BY 4.0.',
    'Every exhibit lists its source and period, with margins of error on survey estimates. Known limitations are published with the method.',
    `Repository: ${REPLICATION_REPO_URL}`,
    'Corrections: jkulla@launchyournextchapter.com',
  ],
} as const

/** One line for a deck's evidence slide. */
export const OPEN_DATA_EVIDENCE_BULLET =
  'The code (MIT) and data (CC BY 4.0) behind the report are public, with known limitations listed, at github.com/justinkulla81/nextchapter-displacement-report.'
