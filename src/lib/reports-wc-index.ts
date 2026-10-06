import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { parseCsv } from '@/lib/warn/csv'

// Reads the published White-Collar Displacement Index history at build time.
// The CSV in public/reports is the same file linked for download, so the page
// and the download can never disagree.

export interface WcIndexPoint {
  /** "YYYY-MM". */
  month: string
  /** White-Collar Displacement Index, 2019 average = 100 (seasonally adjusted, 3-month average). */
  index: number
  /** WC unemployment rate, %, not seasonally adjusted. */
  unemploymentRate: number
  /** Share of unemployed white-collar workers out 27+ weeks, %, NSA. */
  ltuShare: number
  /** Long-term share for white-collar workers 45+, %, NSA. */
  ltuShare45: number
  /** Median weeks unemployed so far (white-collar), NSA. */
  medianWeeks: number
}

const CSV_PATH = path.join(process.cwd(), 'public', 'reports', 'wc-index.csv')

function num(v: string | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/** Every month in the published series, oldest first. */
export function readWcIndex(): WcIndexPoint[] {
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'))
  const [header, ...body] = rows
  const col = (name: string) => header.indexOf(name)
  const iMonth = col('month')
  const iIndex = col('wc_index_2019_100')
  const iUr = col('wc_unemployment_rate_pct_nsa')
  const iShare = col('wc_ltu_share_pct_nsa')
  const iShare45 = col('wc45_ltu_share_pct_nsa')
  const iMedian = col('wc_median_weeks_nsa')
  return body
    .filter((r) => /^\d{4}-\d{2}$/.test(r[iMonth] ?? ''))
    .map((r) => ({
      month: r[iMonth],
      index: num(r[iIndex]),
      unemploymentRate: num(r[iUr]),
      ltuShare: num(r[iShare]),
      ltuShare45: num(r[iShare45]),
      medianWeeks: num(r[iMedian]),
    }))
    .filter((p) => Number.isFinite(p.index))
}

/** Pretty month label, e.g. "2026-08" → "August 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const name = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]
  return `${name} ${y}`
}

/** Short month label, e.g. "2026-08" → "Aug 2026". */
export function monthShort(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const name = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]
  return `${name} ${y}`
}

/** The month one year before the given "YYYY-MM". */
function yearBefore(month: string): string {
  const [y, m] = month.split('-')
  return `${Number(y) - 1}-${m}`
}

export interface WcIndexSummary {
  latest: WcIndexPoint
  /** Same calendar month a year earlier, if present in the series. */
  yearAgo: WcIndexPoint | null
  /** Change in index points vs. a year ago (null when no year-ago reading). */
  yearChange: number | null
  /** The most recent 13 published months, oldest first. */
  last13: WcIndexPoint[]
}

/** Headline figures for the index page and the hub card. */
export function wcIndexSummary(): WcIndexSummary {
  const series = readWcIndex()
  const latest = series[series.length - 1]
  const yearAgo = series.find((p) => p.month === yearBefore(latest.month)) ?? null
  return {
    latest,
    yearAgo,
    yearChange: yearAgo ? latest.index - yearAgo.index : null,
    last13: series.slice(-13),
  }
}
