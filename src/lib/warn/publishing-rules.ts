import type { LayoffType, PublishingRow } from './publishing-queue'

// Filtering, sorting and the daily Google indexing picks for CRM > WARN > Layoff publishing. Pure, so it is tested without a database.

export const DAILY_INDEX_LIMIT = 10
const FRESH_MS = 48 * 60 * 60 * 1000

export type TypeFilter = 'all' | LayoffType
export type WhereFilter = 'us' | 'all'
export type SortKey = 'priority' | 'size' | 'newest'
export interface Filters { type: TypeFilter; where: WhereFilter; sort: SortKey }

export function readFilters(sp: Record<string, string | undefined>): Filters {
  return {
    type: sp.type === 'warn' || sp.type === 'news' || sp.type === 'buyout' ? sp.type : 'all',
    where: sp.where === 'all' ? 'all' : 'us',
    sort: sp.sort === 'size' || sp.sort === 'newest' ? sp.sort : 'priority',
  }
}

const size = (r: PublishingRow) => r.workers ?? 0
const isFresh = (r: PublishingRow, now: number) => now - r.date.getTime() <= FRESH_MS

/** The order to request indexing in: not yet requested, then the last 48 hours, then the largest layoff, then the newest. */
function byPriority(now: number) {
  return (a: PublishingRow, b: PublishingRow) =>
    Number(!!a.indexRequestedAt) - Number(!!b.indexRequestedAt) ||
    Number(isFresh(b, now)) - Number(isFresh(a, now)) ||
    size(b) - size(a) ||
    b.date.getTime() - a.date.getTime()
}

export function applyFilters(rows: PublishingRow[], f: Filters, now = Date.now()): PublishingRow[] {
  const kept = rows.filter((r) => (f.type === 'all' || r.type === f.type) && (f.where === 'all' || r.state != null))
  if (f.sort === 'size') return [...kept].sort((a, b) => size(b) - size(a) || b.date.getTime() - a.date.getTime())
  if (f.sort === 'newest') return [...kept].sort((a, b) => b.date.getTime() - a.date.getTime())
  return [...kept].sort(byPriority(now))
}

/**
 * Today's pages to ask Google to index: U.S. layoffs not yet requested, from the last 48 hours first and the largest first,
 * as many as are left of the day's ten after the requests already made in the last 24 hours. Recomputed on every view, so
 * each day starts a fresh ten.
 */
export function dailyPicks(rows: PublishingRow[], requestsLast24h: number, now = Date.now()): PublishingRow[] {
  const slots = Math.max(0, DAILY_INDEX_LIMIT - requestsLast24h)
  const seen = new Set<string>()
  return rows
    .filter((r) => r.state != null && !r.indexRequestedAt)
    .sort(byPriority(now))
    .filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true)))
    .slice(0, slots)
}
