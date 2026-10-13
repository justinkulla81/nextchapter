// Occupation trend data behind the Pivot Path trend panel. Source: NextChapter
// White Collar Employment Report, September 2026 edition (v1.71+), Chapter 04 and the
// exposure test; replication code code/11_exposure_vs_outcomes.py and data
// data/exposure_test_results.json in the replication repository. Census CPS
// basic monthly microdata, January to August of each year (NextChapter
// calculation). aiExposure is the employment-weighted Eloundou et al. (2024)
// task-exposure score (0 to 100): what AI could do in principle, not a
// measured job loss. employmentChangePct is 2022 to 2026, CPS. longSearchShare
// is the share of unemployed people whose last job was in the group who have
// been out 27+ weeks, 2026; longSearchChangePts is the change since 2022.
// Refresh each month from the latest report edition; never edit by hand.

export interface OccupationTrendRow {
  socGroup: string // SOC major group code, e.g. '15'
  name: string
  aiExposure: number
  employmentChangePct: number
  longSearchSharePct: number
  longSearchChangePts: number
  respondents: number // unweighted unemployed respondents, Jan-Aug 2026
}

export const OCCUPATION_TRENDS_SOURCE = {
  edition: 'September 2026',
  version: '1.72',
  title: 'NextChapter White Collar Employment Report',
  note: 'NextChapter calculation from Census CPS microdata; AI exposure from Eloundou et al. (2024)',
  url: 'https://launchyournextchapter.com/reports/displacement-report-september-2026',
} as const

export const OCCUPATION_TRENDS: OccupationTrendRow[] = [
  { socGroup: '11', name: 'Management', aiExposure: 46.9, employmentChangePct: 3.4, longSearchSharePct: 30.3, longSearchChangePts: 3.3, respondents: 1029 },
  { socGroup: '13', name: 'Business & financial', aiExposure: 54.0, employmentChangePct: 10.8, longSearchSharePct: 30.5, longSearchChangePts: 5.1, respondents: 530 },
  { socGroup: '15', name: 'Computer & math', aiExposure: 75.3, employmentChangePct: 12.4, longSearchSharePct: 41.0, longSearchChangePts: 12.7, respondents: 462 },
  { socGroup: '17', name: 'Architecture & engineering', aiExposure: 51.6, employmentChangePct: 8.2, longSearchSharePct: 28.3, longSearchChangePts: -1.7, respondents: 136 },
  { socGroup: '19', name: 'Life, physical & social science', aiExposure: 45.1, employmentChangePct: 4.1, longSearchSharePct: 24.8, longSearchChangePts: 4.0, respondents: 99 },
  { socGroup: '21', name: 'Community & social service', aiExposure: 32.0, employmentChangePct: -1.1, longSearchSharePct: 28.8, longSearchChangePts: 1.3, respondents: 127 },
  { socGroup: '23', name: 'Legal', aiExposure: 46.5, employmentChangePct: -0.4, longSearchSharePct: 39.7, longSearchChangePts: 10.7, respondents: 56 },
  { socGroup: '25', name: 'Education', aiExposure: 37.0, employmentChangePct: 1.3, longSearchSharePct: 18.9, longSearchChangePts: 3.5, respondents: 695 },
  { socGroup: '27', name: 'Arts, design & media', aiExposure: 48.1, employmentChangePct: 1.3, longSearchSharePct: 23.2, longSearchChangePts: -3.9, respondents: 394 },
  { socGroup: '29', name: 'Healthcare practitioners', aiExposure: 35.2, employmentChangePct: 7.4, longSearchSharePct: 22.6, longSearchChangePts: 2.7, respondents: 335 },
  { socGroup: '31', name: 'Healthcare support', aiExposure: 21.3, employmentChangePct: 17.7, longSearchSharePct: 25.9, longSearchChangePts: -1.6, respondents: 480 },
  { socGroup: '33', name: 'Protective service', aiExposure: 24.3, employmentChangePct: 3.4, longSearchSharePct: 19.1, longSearchChangePts: -7.9, respondents: 204 },
  { socGroup: '35', name: 'Food preparation', aiExposure: 14.5, employmentChangePct: 4.7, longSearchSharePct: 22.7, longSearchChangePts: 1.5, respondents: 1097 },
  { socGroup: '37', name: 'Building & grounds', aiExposure: 3.1, employmentChangePct: 2.2, longSearchSharePct: 31.0, longSearchChangePts: 6.2, respondents: 678 },
  { socGroup: '39', name: 'Personal care', aiExposure: 17.8, employmentChangePct: 2.1, longSearchSharePct: 21.8, longSearchChangePts: 0.4, respondents: 371 },
  { socGroup: '41', name: 'Sales', aiExposure: 40.9, employmentChangePct: -1.6, longSearchSharePct: 28.9, longSearchChangePts: 6.5, respondents: 1256 },
  { socGroup: '43', name: 'Office & admin support', aiExposure: 60.0, employmentChangePct: 0.8, longSearchSharePct: 26.4, longSearchChangePts: 5.7, respondents: 1277 },
  { socGroup: '45', name: 'Farming', aiExposure: 13.7, employmentChangePct: -1.5, longSearchSharePct: 18.2, longSearchChangePts: 0.5, respondents: 176 },
  { socGroup: '47', name: 'Construction', aiExposure: 12.1, employmentChangePct: -4.0, longSearchSharePct: 19.6, longSearchChangePts: -1.2, respondents: 1064 },
  { socGroup: '49', name: 'Installation & repair', aiExposure: 15.9, employmentChangePct: 1.8, longSearchSharePct: 29.0, longSearchChangePts: 2.2, respondents: 317 },
  { socGroup: '51', name: 'Production', aiExposure: 16.7, employmentChangePct: -5.5, longSearchSharePct: 23.8, longSearchChangePts: 1.1, respondents: 592 },
  { socGroup: '53', name: 'Transportation', aiExposure: 17.6, employmentChangePct: 1.9, longSearchSharePct: 22.8, longSearchChangePts: 0.1, respondents: 1429 },
]

// Customer service representatives (CPS occupation code 5240), the report's
// test of whether work built around scripted conversation changes first.
export const CUSTOMER_SERVICE_TREND = {
  name: 'Customer service representatives',
  employmentChangePct2025to2026: -7.8,
  employmentChangeThousands: -206,
  marginThousands: 111,
  note: 'Consistent with, but not proof of, AI taking over routine service conversations (report feature).',
} as const
