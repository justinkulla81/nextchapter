/**
 * Approved message: "A longer search is not a personal failure."
 *
 * One source for the public report landing page, the pitch copy library and
 * social posts, so the figures cannot drift. Every figure is from the
 * NextChapter White Collar Employment Report, October 2026 edition, with its
 * source and period attached.
 *
 * Voice (feedback_marketing_copy_voice): plain, declarative, no euphemisms.
 * Guardrail: never say AI caused the rise. The report states it cannot
 * establish that, and this copy must not either.
 */

export interface MessageFigure {
  id: 'wc-long-search' | 'all-unemployed-share' | 'wc-labor-force'
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
    value: '28.5%',
    label: 'of unemployed white-collar workers had been out of work 27 weeks or more',
    comparison: 'January to September 2026, against 23.2% in the same months of 2025. The rise, +5.3 points, is larger than its 90% margin of error (±2.3).',
    source: 'NextChapter calculation from U.S. Census Bureau Current Population Survey microdata. Not seasonally adjusted; same months each year.',
    reportRef: 'Executive summary and Exhibit 3',
    beyondMargin: true,
  },
  {
    id: 'all-unemployed-share',
    value: '25.8%',
    label: 'of all unemployed people had been out of work 27 weeks or more',
    comparison: 'January to September 2026, against 22.7% in 2025. The rise, +3.1 points, is larger than its 90% margin of error (±1.1). The same method gives 25.8%, against 25.9% published by the Bureau of Labor Statistics.',
    source: 'NextChapter calculation from U.S. Census Bureau Current Population Survey microdata. Not seasonally adjusted; same months each year.',
    reportRef: 'Exhibit 3 and the check against BLS',
    beyondMargin: true,
  },
  {
    id: 'wc-labor-force',
    value: '0.75%',
    label: 'of the white-collar labor force was unemployed 27 weeks or more',
    comparison: 'January to September 2026, against about 0.58% in 2025: the white-collar unemployment rate (2.63%, from 2.48%) times the share out 27+ weeks. No margin of error is published for this product.',
    source: 'NextChapter calculation from U.S. Census Bureau Current Population Survey microdata. Not seasonally adjusted; same months each year.',
    reportRef: 'Executive summary',
    beyondMargin: false,
  },
]

export const LONGER_SEARCH_HEADLINE = 'A longer search is not a personal failure.'

/** Full block for the report landing page and the website. */
export const LONGER_SEARCH_BODY: string[] = [
  'Hiring improved in October. More of the unemployed white-collar workers are in long spells than a year ago.',
  'Among unemployed managers and professionals, 28.5% had been out of work 27 weeks or more in January to September 2026, up from 23.2% a year earlier. Across all unemployed workers it is 25.8%, up from 22.7%. Both rises are larger than their margins of error. Unemployment itself is low for white-collar workers: 2.63%.',
  'If your search is taking months, you are not the exception. More than one in four unemployed people are in the same position. The report measures how long unemployment spells have lasted so far. It does not claim to know why.',
]

/** Two sentences for a pitch deck, email or leave-behind. Same figures, same sources. */
export const LONGER_SEARCH_SHORT =
  'A longer search is not a personal failure. Among unemployed white-collar workers, 28.5% had been out of work 27 weeks or more in January to September 2026, up from 23.2% a year earlier (NextChapter White Collar Employment Report, from Census CPS microdata).'

/** For the pitch copy library: a bullet that fits a "Why now" or "Problem" slide. */
export const LONGER_SEARCH_PITCH_BULLET =
  'Long searches are rising: 28.5% of unemployed white-collar workers were out 27 weeks or more in January to September 2026, against 23.2% a year earlier (NextChapter White Collar Employment Report).'

/** What this message must not say. Shown to whoever edits the copy. */
export const LONGER_SEARCH_GUARDRAILS: string[] = [
  'Do not say AI caused the rise. The report states it cannot establish a cause.',
  'Do not drop the period. Every figure here is a January to September average, not seasonally adjusted.',
  'Do not compare month to month. Use the year-over-year change, which is larger than the margin of error.',
]
