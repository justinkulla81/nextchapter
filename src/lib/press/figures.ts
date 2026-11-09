// Figures a reporter can cite, with where each comes from. Anything computed (the index, the layoff counts, the AI-skill pay
// premium) is read live by the /press page from the same functions the source pages use. The January-September comparison below is
// published in the October report's body (a static table), so it is kept here as one dated constant and a test
// (src/test/press-figures.test.ts) fails if the report text and this file ever disagree.

export const PRESS_CONTACT_EMAIL = 'justin@launchyournextchapter.com'

/** The October 2026 report's comparison of January-September averages (not seasonally adjusted, same months each year). */
export const LTU_JAN_SEP = {
  period: 'January–September 2026 compared with January–September 2025',
  /** Unemployed white-collar workers out 27+ weeks, as a share of the white-collar unemployed. */
  whiteCollarShare: { y2026: 28.5, y2025: 23.2, change: 5.3, margin90: 2.3 },
  /** All unemployed workers out 27+ weeks, as a share of all unemployed. */
  allShare: { y2026: 25.8, y2025: 22.7, change: 3.1, margin90: 1.1 },
  reportPath: '/reports/white-collar-employment-report-october-2026',
  source:
    'NextChapter calculation from U.S. Census Bureau Current Population Survey microdata. Margins of error are 90% margins on the change, by the BLS generalized variance method.',
} as const

/** What a single month's reading of the index can and cannot say. Stated in the report; repeated wherever the index is quoted. */
export const SINGLE_MONTH_CAUTION =
  'The margin of error on the three-month index is about ±17 points, so its gap with a year ago is within sampling noise on its own, and a single month is noisier still. The January–September comparison is the one to rely on.'

/** Corrections to published figures, newest first. Empty is fine; an entry is dated and says what changed and what did not. */
export const PRESS_CORRECTIONS: { date: string; text: string }[] = [
  {
    date: '2026-10-27',
    text: 'White-Collar Long-Search Index page: the year-over-year change was worked out from the two rounded levels (162 minus 128 = 34). From the unrounded values it is 33.4, now shown as 33. The levels (161.6 for August 2026, 128.2 for August 2025) and the data file did not change.',
  },
]

/** When this page's wording was last reviewed by a person (the figures in it update on their own). */
export const PRESS_PAGE_REVIEWED = '2026-10-27'

/** "NextChapter, “title”, <as of or period>, <url>, accessed <date>, CC BY 4.0." One shape for every figure. */
export function citationText(title: string, asOf: string, url: string, accessed: string, license = 'CC BY 4.0'): string {
  return `NextChapter, “${title}”, ${asOf}, ${url}. Accessed ${accessed}. Licensed ${license}.`
}
