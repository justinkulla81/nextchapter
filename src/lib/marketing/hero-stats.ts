/**
 * The four statistics in the homepage hero. One source so every figure keeps
 * its citation, a balanced mix (two bright spots, two clouds) and an evidence
 * tag. Report figures come from the NextChapter Employment Report, September
 * 2026 (v1.8); see longer-search-message.ts for the same numbers with periods.
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
    source: 'BLS Displaced Worker Survey, Aug 2026',
    sourceUrl: 'https://www.bls.gov/news.release/archives/disp_08272026.htm',
    evidence: 'P',
  },
  {
    value: '612,000',
    label: 'jobs added in the first nine months of 2026',
    tone: 'bright-spot',
    source: 'NextChapter Employment Report, Sept 2026 (BLS data)',
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
    label: 'of white-collar workers had searched 27+ weeks, up from 0.56% a year earlier',
    tone: 'cloud',
    source: 'NextChapter Employment Report, Sept 2026 (Census CPS)',
    sourceUrl: '/reports/latest',
    evidence: 'P',
  },
]
