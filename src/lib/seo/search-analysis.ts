import { OTHER_GROUP, QUERY_GROUPS, type QueryGroup } from '@/lib/seo/query-groups'

// Pure analysis of Search Console rows for the admin "Search queries" page (src/app/support/admin/(portal)/search-queries). No I/O, so
// the rules (what counts as a near miss, a page-two query, a change) are unit-tested in src/test/search-analysis.test.ts.

export type PerfWindowDays = 7 | 28 | 90
export const PERF_WINDOWS: PerfWindowDays[] = [7, 28, 90]

export interface PerfWindow {
  startDate: string
  endDate: string
}

// Search Console trails real time by about two days; ending two days back keeps every day in a window complete.
const LAG_DAYS = 2
const DAY_MS = 24 * 60 * 60 * 1000

/** The window of `days` days ending LAG_DAYS before `now` (UTC dates), and the window of the same length right before it. */
export function perfWindows(days: number, now: Date = new Date()): { current: PerfWindow; previous: PerfWindow } {
  const day = (d: Date) => d.toISOString().slice(0, 10)
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - LAG_DAYS * DAY_MS)
  const start = new Date(end.getTime() - (days - 1) * DAY_MS)
  const prevEnd = new Date(start.getTime() - DAY_MS)
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * DAY_MS)
  return { current: { startDate: day(start), endDate: day(end) }, previous: { startDate: day(prevStart), endDate: day(prevEnd) } }
}

/** One Search Console row: a search term and the page Google sent it to. `position` is Google's average position for that row. */
export interface PerfRow {
  query: string
  page: string
  clicks: number
  impressions: number
  position: number
}

export interface Totals {
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface QueryAgg {
  query: string
  clicks: number
  impressions: number
  ctr: number
  /** Average position, weighted by impressions across the pages the term landed on. */
  position: number
  /** The page that got the most impressions for this term, and how many pages it landed on. */
  topPage: string
  pages: number
  prevClicks: number
  prevImpressions: number
}

export interface PageAgg {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  prevClicks: number
  prevImpressions: number
}

export interface GroupAgg {
  key: string
  label: string
  note: string
  queries: number
  clicks: number
  impressions: number
  ctr: number
  position: number
  prevClicks: number
  prevImpressions: number
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : 0)

function weightedPosition(rows: { impressions: number; position: number }[]): number {
  const impressions = rows.reduce((s, r) => s + r.impressions, 0)
  if (impressions === 0) return 0
  return rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions
}

export function sumRows(rows: PerfRow[]): Totals {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0)
  const impressions = rows.reduce((s, r) => s + r.impressions, 0)
  return { clicks, impressions, ctr: ratio(clicks, impressions), position: weightedPosition(rows) }
}

/** The change from `prev` to `cur`: a fraction (0.25 = up 25%), or null when there was nothing before to compare to. */
export function pctChange(cur: number, prev: number): number | null {
  return prev > 0 ? (cur - prev) / prev : null
}

function previousBy(rows: PerfRow[], key: (r: PerfRow) => string): Map<string, { clicks: number; impressions: number }> {
  const out = new Map<string, { clicks: number; impressions: number }>()
  for (const r of rows) {
    const p = out.get(key(r)) ?? { clicks: 0, impressions: 0 }
    p.clicks += r.clicks
    p.impressions += r.impressions
    out.set(key(r), p)
  }
  return out
}

function groupBy(rows: PerfRow[], key: (r: PerfRow) => string): Map<string, PerfRow[]> {
  const out = new Map<string, PerfRow[]>()
  for (const r of rows) {
    const list = out.get(key(r))
    if (list) list.push(r)
    else out.set(key(r), [r])
  }
  return out
}

/** One row per search term, with the previous window's clicks and impressions beside it. Sorted by clicks, then impressions. */
export function aggregateQueries(rows: PerfRow[], prevRows: PerfRow[] = []): QueryAgg[] {
  const prev = previousBy(prevRows, (r) => r.query)
  const out: QueryAgg[] = []
  for (const [query, list] of groupBy(rows, (r) => r.query)) {
    const t = sumRows(list)
    const top = [...list].sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)[0]
    const p = prev.get(query)
    out.push({ query, clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position, topPage: top.page, pages: list.length, prevClicks: p?.clicks ?? 0, prevImpressions: p?.impressions ?? 0 })
  }
  return out.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
}

export function aggregatePages(rows: PerfRow[], prevRows: PerfRow[] = []): PageAgg[] {
  const prev = previousBy(prevRows, (r) => r.page)
  const out: PageAgg[] = []
  for (const [page, list] of groupBy(rows, (r) => r.page)) {
    const t = sumRows(list)
    const p = prev.get(page)
    out.push({ page, clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position, prevClicks: p?.clicks ?? 0, prevImpressions: p?.impressions ?? 0 })
  }
  return out.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
}

/** Searches that showed us but were never clicked, most-seen first. Below `minImpressions` it is noise, not a near miss. */
export function nearMisses(queries: QueryAgg[], minImpressions = 3): QueryAgg[] {
  return queries.filter((q) => q.clicks === 0 && q.impressions >= minImpressions).sort((a, b) => b.impressions - a.impressions || a.position - b.position)
}

/** Searches where we average position 8 to 20 (the bottom of page one and page two): the cheapest wins, most-seen first. */
export function pageTwoQueries(queries: QueryAgg[], opts: { minImpressions?: number; from?: number; to?: number } = {}): QueryAgg[] {
  const { minImpressions = 3, from = 8, to = 20 } = opts
  return queries.filter((q) => q.impressions >= minImpressions && q.position >= from && q.position <= to).sort((a, b) => b.impressions - a.impressions || a.position - b.position)
}

/** Per group: how many distinct searches, clicks, impressions, position, and the previous window. A row can sit in several groups. */
export function groupStats(rows: PerfRow[], prevRows: PerfRow[], groups: QueryGroup[] = QUERY_GROUPS): GroupAgg[] {
  const build = (g: { key: string; label: string; note: string }, inGroup: (r: PerfRow) => boolean): GroupAgg => {
    const cur = rows.filter(inGroup)
    const t = sumRows(cur)
    const p = sumRows(prevRows.filter(inGroup))
    return { key: g.key, label: g.label, note: g.note, queries: new Set(cur.map((r) => r.query)).size, clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position, prevClicks: p.clicks, prevImpressions: p.impressions }
  }
  const stats = groups.map((g) => build(g, (r) => g.matches(r)))
  stats.push(build(OTHER_GROUP, (r) => !groups.some((g) => g.matches(r))))
  return stats
}

/** A spreadsheet cell: text starting with = + - or @ is prefixed so the sheet reads it as text, not a formula. */
export function csvCell(v: string | number): string {
  if (typeof v === 'number') return String(Number.isFinite(v) ? v : '')
  return `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  return [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n')
}
