/**
 * The four statistics in the homepage hero. One source so every figure keeps
 * its citation, a balanced mix (two bright spots, two clouds) and an evidence
 * tag. Report figures come from the NextChapter White Collar Employment Report, October
 * 2026 edition; longer-search-message.ts still carries the September edition's figures with periods.
 *
 * Evidence: 'P' primary source, 'S' press or secondary. Anything that cannot be
 * sourced does not belong here.
 */

export interface HeroStat {
  value: string
  /** What the figure measures, one line. */
  label: string
  tone: 'bright-spot' | 'cloud'
  /** Short source line shown under the figure. */
  source: string
  sourceUrl: string
  evidence: 'P' | 'S'
}

export const HERO_STATS: HeroStat[] = [
  {
    value: '66.1%',
    label: 'of long-tenured workers who lost a job were working again by January 2026',
    tone: 'bright-spot',
    source: 'BLS survey of workers who lost jobs, Aug 2026',
    sourceUrl: 'https://www.bls.gov/news.release/archives/disp_08272026.htm',
    evidence: 'P',
  },
  {
    value: '165,000',
    label: 'jobs added in October 2026, and unemployment edged down to 4.1%',
    tone: 'bright-spot',
    source: 'NextChapter White Collar Employment Report, Oct 2026 (BLS data, seasonally adjusted)',
    sourceUrl: '/reports/latest',
    evidence: 'P',
  },
  {
    value: '1 in 4',
    label: 'mid-career professionals went 5+ years without a meaningful promotion or raise',
    tone: 'cloud',
    source: 'Burning Glass Institute and NYU SPS, May 2026',
    sourceUrl:
      'https://www.sps.nyu.edu/about/news-and-ideas/articles/press-releases/2026/1-in-4-mid-career-professionals-stranded-in-career-stall-new-nyu-sps-burning-glass-institute-report.html',
    evidence: 'S',
  },
  {
    value: '0.75%',
    label: 'of the white-collar labor force was unemployed 27+ weeks, January to September 2026, up from about 0.58% a year earlier',
    tone: 'cloud',
    source: 'NextChapter White Collar Employment Report, Oct 2026 (Census CPS, our calculation)',
    sourceUrl: '/reports/latest',
    evidence: 'P',
  },
]
