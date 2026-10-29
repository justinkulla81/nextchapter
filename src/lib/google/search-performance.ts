import 'server-only'
import { unstable_cache } from 'next/cache'
import { getAllGoogleConnections, getValidAccessTokenFor } from './connection'
import { classifyForbidden, pickSite, type ForbiddenReason, type SearchConsoleResult } from './search-console'
import { perfWindows, type PerfRow, type PerfWindow, type PerfWindowDays, type Totals } from '@/lib/seo/search-analysis'

// Search Console performance for the admin "Search queries" page: one window of search-term-by-page rows, the same length window just
// before it, and exact totals for both (the totals include the searches Google hides for privacy; the rows do not). Read-only: the same
// webmasters.readonly grant the Visitors page uses. Four Google calls per window, cached for an hour; nothing here is called per row.

const API = 'https://www.googleapis.com/webmasters/v3'
const ROW_LIMIT = 25000

export interface SearchPerformance {
  siteUrl: string
  days: PerfWindowDays
  current: PerfWindow
  previous: PerfWindow
  rows: PerfRow[]
  prevRows: PerfRow[]
  totals: Totals
  prevTotals: Totals
  /** True when Google returned a full page of rows, so the lists may be missing the rarest searches. */
  truncated: boolean
}

export type SearchPerformanceResult = ({ status: 'ok' } & SearchPerformance) | Exclude<SearchConsoleResult, { status: 'ok' }>

class HttpError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`Search Console ${status}: ${body.slice(0, 300)}`)
  }
}

function googleMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } }
    if (parsed.error?.message) return parsed.error.message
  } catch {
    // not JSON
  }
  return body.slice(0, 200)
}

interface ApiRow {
  keys?: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

async function post(token: string, siteUrl: string, body: Record<string, unknown>): Promise<ApiRow[]> {
  const res = await fetch(`${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new HttpError(res.status, await res.text())
  return ((await res.json()) as { rows?: ApiRow[] }).rows ?? []
}

const toTotals = (rows: ApiRow[]): Totals => {
  const r = rows[0]
  return r ? { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position } : { clicks: 0, impressions: 0, ctr: 0, position: 0 }
}

const toPerfRows = (rows: ApiRow[]): PerfRow[] =>
  rows.map((r) => ({ query: r.keys?.[0] ?? '', page: r.keys?.[1] ?? '', clicks: r.clicks, impressions: r.impressions, position: r.position }))

async function load(days: PerfWindowDays): Promise<SearchPerformanceResult> {
  const connections = await getAllGoogleConnections()
  if (connections.length === 0) return { status: 'not_connected' }

  let forbidden: { reason: ForbiddenReason; detail: string } | null = null
  let lastSites: string[] = []
  for (const connection of connections) {
    try {
      const token = await getValidAccessTokenFor(connection)
      const sitesRes = await fetch(`${API}/sites`, { headers: { Authorization: `Bearer ${token}` } })
      if (!sitesRes.ok) throw new HttpError(sitesRes.status, await sitesRes.text())
      const sites = ((await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] }).siteEntry ?? []
      const siteUrl = pickSite(sites)
      if (!siteUrl) {
        lastSites = sites.map((s) => s.siteUrl)
        continue
      }
      const { current, previous } = perfWindows(days)
      const dims = { dimensions: ['query', 'page'], rowLimit: ROW_LIMIT }
      const [rows, prevRows, totals, prevTotals] = await Promise.all([
        post(token, siteUrl, { ...current, ...dims }),
        post(token, siteUrl, { ...previous, ...dims }),
        post(token, siteUrl, { ...current }),
        post(token, siteUrl, { ...previous }),
      ])
      return {
        status: 'ok',
        siteUrl,
        days,
        current,
        previous,
        rows: toPerfRows(rows),
        prevRows: toPerfRows(prevRows),
        totals: toTotals(totals),
        prevTotals: toTotals(prevTotals),
        truncated: rows.length >= ROW_LIMIT || prevRows.length >= ROW_LIMIT,
      }
    } catch (err) {
      if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
        forbidden = { reason: classifyForbidden(err.status, err.body), detail: `${connection.email}: ${googleMessage(err.body)}` }
        continue
      }
      console.error('Search performance load failed:', err instanceof Error ? err.message : err)
      return { status: 'error', message: err instanceof HttpError ? `Google said ${googleMessage(err.body)}` : err instanceof Error ? err.message : 'Unknown error' }
    }
  }
  if (forbidden) return { status: 'needs_reconnect', ...forbidden }
  return { status: 'no_site', sites: lastSites }
}

/** The same read without the cache: for scripts and tests. Pages use loadSearchPerformance. */
export const loadSearchPerformanceUncached = load

// A working answer is cached for an hour (the data only updates daily). Anything else throws inside the cached function, which Next does
// not store, so fixing the connection shows up on the next load.
class NotCacheable extends Error {
  constructor(readonly result: SearchPerformanceResult) {
    super('not cacheable')
  }
}

const loadCached = unstable_cache(
  async (days: PerfWindowDays) => {
    const result = await load(days)
    if (result.status !== 'ok') throw new NotCacheable(result)
    return result
  },
  ['admin-search-performance'],
  { revalidate: 3600, tags: ['admin-search-performance'] },
)

export async function loadSearchPerformance(days: PerfWindowDays): Promise<SearchPerformanceResult> {
  try {
    return await loadCached(days)
  } catch (err) {
    if (err instanceof NotCacheable) return err.result
    throw err
  }
}
