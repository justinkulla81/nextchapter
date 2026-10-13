// Sourced public benchmarks for the outcomes release. Every row names its
// source. This is a STARTER set compiled from search results on 2026-10-13:
// BLS, Federal Reserve and NBER pages could not be opened directly, so figures
// came from search summaries and are flagged isSampleData = true and LOW or
// MEDIUM confidence until someone verifies them against the original page.
// Where no sourced number exists we deliberately seed NOTHING (uplift and pay
// estimates then show "not enough data" instead of a guess).

import { monthlyToWeeklyRate } from './uplift'
import type { PayBenchmarkRow } from './pay-change-estimate'

export interface DurationSeed {
  bucket: 'W0_4' | 'W5_13' | 'W14_26' | 'W27_52' | 'W53_PLUS'
  group: string
  weeklyReemploymentRate: number
  sourceTitle: string
  sourceUrl: string | null
  asOf: string | null
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  notes: string
}

// Only two duration rows have a sourced number behind them. Both come from one
// Federal Reserve FEDS Note on monthly persistence of unemployment, converted
// from a monthly to a weekly exit probability. The Great Recession figure is
// recession-era and likely overstates normal-times exit from short spells, so it
// is LOW confidence. 5-13, 27-52 and 53+ week buckets have NO sourced rate yet:
// populate from CPS duration tables (BLS A-12/A-36 flows) before relying on them.
export const DURATION_SEED: DurationSeed[] = [
  {
    bucket: 'W14_26',
    group: 'all',
    weeklyReemploymentRate: monthlyToWeeklyRate(0.19) as number,
    sourceTitle: 'Federal Reserve FEDS Note on factors in unemployment persistence (4-6 months unemployed: 81% remain unemployed next month)',
    sourceUrl: 'https://www.federalreserve.gov/econres/notes/feds-notes/',
    asOf: null,
    confidence: 'LOW',
    notes: 'Exit from unemployment (to employment OR leaving the labor force), not re-employment alone, so this overstates re-employment. Converted from monthly 19% to weekly. Verify against the original note.',
  },
  {
    bucket: 'W0_4',
    group: 'all',
    weeklyReemploymentRate: monthlyToWeeklyRate(0.36) as number,
    sourceTitle: 'Federal Reserve FEDS Note on unemployment persistence (newly unemployed, Great Recession: 64% remain unemployed next month)',
    sourceUrl: 'https://www.federalreserve.gov/econres/notes/feds-notes/',
    asOf: null,
    confidence: 'LOW',
    notes: 'Great Recession era and includes leaving the labor force; use only as a placeholder until a normal-times CPS flow rate replaces it.',
  },
]

export const PAY_CHANGE_SEED: Array<PayBenchmarkRow & { notes: string }> = [
  {
    pathType: 'RESET',
    group: 'UK full-time career changers (average annual pay cut)',
    lowPct: -14,
    highPct: -14,
    medianPct: null,
    sampleSize: null,
    confidence: 'LOW',
    sourceTitle: 'Learning and Work Institute (UK career changers)',
    sourceUrl: 'https://learningandwork.org.uk/?p=22068',
    asOf: null,
    notes: 'UK, all career changers, a single average. Not US white-collar specific.',
  },
  {
    pathType: 'RESET',
    group: 'High-tenure displaced workers, long-run annual earnings loss',
    lowPct: -25,
    highPct: -25,
    medianPct: null,
    sampleSize: null,
    confidence: 'LOW',
    sourceTitle: 'Jacobson, LaLonde and Sullivan, via Chicago Fed Economic Perspectives (2005)',
    sourceUrl: 'https://www.chicagofed.org/publications/economic-perspectives/2005/2q-',
    asOf: '1980s data',
    notes: 'Earnings (not hourly pay) for 6+ year tenure workers displaced from distressed firms in Pennsylvania, early 1980s. Dated; include only as a worst-case reference.',
  },
  {
    pathType: 'RESET',
    group: 'Displaced men with 3+ years tenure, immediate annual earnings drop in expansions',
    lowPct: -25,
    highPct: -25,
    medianPct: null,
    sampleSize: null,
    confidence: 'LOW',
    sourceTitle: 'Davis and von Wachter, Recessions and the Costs of Job Loss (NBER w17638)',
    sourceUrl: 'https://www.nber.org/papers/w17638',
    asOf: null,
    notes: 'Earnings, not wages; includes time out of work. Recessions: -39%.',
  },
]

// Reference statistics for UI copy (not used as ranges). All from the BLS
// Displaced Worker Survey release of 2026-08-27 as relayed by search summaries
// and the NextChapter Displacement Report (Sept 2026). Verify before publishing.
export const REFERENCE_STATS = {
  longTenuredReemployedPct: { all: 66.1, age25to54: 72.9, age55to64: 57.3, age65plus: 38.6 },
  fullTimeReemployedEarningAsMuchOrMorePct: 49,
  source: 'BLS Displaced Worker Survey, displaced 2023-2025 (release 2026-08-27)',
  sourceUrl: 'https://www.bls.gov/news.release/disp.nr0.htm',
} as const
