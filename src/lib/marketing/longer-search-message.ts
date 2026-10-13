/**
 * Approved message: "A longer search is not a personal failure."
 *
 * One source for the public report landing page, the pitch copy library and
 * social posts, so the figures cannot drift. Every figure is from the
 * NextChapter White Collar Employment Report, September 2026 edition (Version 1.72), with its
 * source and period attached.
 *
 * Voice (feedback_marketing_copy_voice): plain, declarative, no euphemisms.
 * Guardrail: never say AI caused the rise. The report states it cannot
 * establish that, and this copy must not either.
 */

export interface MessageFigure {
  id: 'wc-long-search' | 'all-unemployed-share' | 'us-born'
  value: string
  /** What the value measures, one line. */
  label: string
  /** The comparison, with its period. */
  comparison: string
  /** Source line, as the report prints it. */
  source: string
  /** Where it sits in the report. */
  reportRef: string
  /** True when the change is larger than the 90% margin of error. */
  beyondMargin: boolean
}

export const LONGER_SEARCH_FIGURES: MessageFigure[] = [
  {
    id: 'wc-long-search',
    value: '0.75%',
    label: 'of the white-collar labor force was unemployed 27 weeks or more',
    comparison: 'January to August 2026, against 0.56% in 2025 (and 0.47% in 2019). The one-year rise, +0.18 points, is larger than its 90% margin of error (±0.08).',
    source: 'NextChapter calculation from U.S. Census Bureau Current Population Survey microdata. Not seasonally adjusted; same months each year.',
    reportRef: 'Executive summary and Exhibit 2',
    beyondMargin: true,
  },
  {
    id: 'all-unemployed-share',
    value: '27.1%',
    label: 'of all unemployed people had been looking for 27 weeks or more',
    comparison: 'September 2026, against 23.6% a year earlier (1.94 million people).',
    source: 'Bureau of Labor Statistics, Employment Situation, September 2026. Seasonally adjusted.',
    reportRef: 'Executive summary and Chapter 06',
    beyondMargin: false,
  },
  {
    id: 'us-born',
    value: '0.73%',
    label: 'of U.S.-born white-collar workers were unemployed 27 weeks or more',
    comparison: 'January to August 2026, against 0.52% in 2025. The rise is larger than its 90% margin of error (+0.20 points, ±0.08).',
    source: 'NextChapter calculation from U.S. Census Bureau Current Population Survey microdata. Not seasonally adjusted.',
    reportRef: 'Chapter 04, nativity breakdown',
    beyondMargin: true,
  },
]

export const LONGER_SEARCH_HEADLINE = 'A longer search is not a personal failure.'

/** Full block for the report landing page and the website. */
export const LONGER_SEARCH_BODY: string[] = [
  'Fewer people are losing jobs. The ones who do are staying out longer.',
  'Among managers and professionals, 0.75% of the white-collar labor force was unemployed for 27 weeks or more in January to August 2026, up from 0.56% a year earlier. Across all workers, 27.1% of the unemployed have been looking for 27 weeks or more, up from 23.6%. The rise shows up among U.S.-born professionals too: 0.73%, up from 0.52%.',
  'If your search is taking months, you are not the exception. More than one in four unemployed people are in the same position. The report measures how long searches last. It does not claim to know why.',
]

/** Two sentences for a pitch deck, email or leave-behind. Same figures, same sources. */
export const LONGER_SEARCH_SHORT =
  'A longer search is not a personal failure. White-collar workers unemployed 27 weeks or more rose to 0.75% of the white-collar labor force in January to August 2026, from 0.56% a year earlier (NextChapter White Collar Employment Report, from Census CPS microdata).'

/** For the pitch copy library: a bullet that fits a "Why now" or "Problem" slide. */
export const LONGER_SEARCH_PITCH_BULLET =
  'Long searches are rising: 0.75% of the white-collar labor force was out 27 weeks or more in January to August 2026, against 0.56% a year earlier (NextChapter White Collar Employment Report).'

/** What this message must not say. Shown to whoever edits the copy. */
export const LONGER_SEARCH_GUARDRAILS: string[] = [
  'Do not say AI caused the rise. The report states it cannot establish a cause.',
  'Do not drop the period. The 0.75% is January to August averages, not seasonally adjusted; the 27.1% is September, seasonally adjusted.',
  'Do not compare month to month. Use the year-over-year change, which is larger than the margin of error.',
]
