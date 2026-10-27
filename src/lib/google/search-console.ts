import 'server-only'
import { unstable_cache } from 'next/cache'
import { getAllGoogleConnections, getValidAccessTokenFor } from './connection'

// Google Search Console is the only place the actual Google search terms
// behind a visit exist — the browser referrer is just "https://www.google.com/".
// Reads through the admin Google grant already stored for the CRM/Gmail
// features (GoogleInboxConnection); no new table. A grant made before the
// webmasters.readonly scope was added answers 403 here, which the Visitors page
// shows as "Reconnect Google".

const API = 'https://www.googleapis.com/webmasters/v3'
const SITE_HOST = 'launchyournextchapter.com'
// Search Console data trails real time by ~2 days; ending at "today" just
// returns the same rows minus the missing days.
const WINDOW_DAYS = 28

// Why Google refused. A 403 has three very different causes and only the first
// is fixed by reconnecting, so the page must not call them all "reconnect".
export type ForbiddenReason = 'scope_missing' | 'api_disabled' | 'no_permission' | 'unknown'

export function classifyForbidden(status: number, body: string): ForbiddenReason {
  const text = body.toLowerCase()
  if (text.includes('accessnotconfigured') || text.includes('service_disabled') || text.includes('has not been used in project') || text.includes('is disabled')) return 'api_disabled'
  if (text.includes('insufficient') && text.includes('scope')) return 'scope_missing'
  if (status === 401) return 'scope_missing'
  if (text.includes('user does not have sufficient permission') || text.includes('sufficient permission')) return 'no_permission'
  return 'unknown'
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

export interface SearchRow {
  key: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type SearchConsoleResult =
  | { status: 'ok'; siteUrl: string; startDate: string; endDate: string; queries: SearchRow[]; pages: SearchRow[] }
  | { status: 'not_connected' }
  | { status: 'needs_reconnect'; reason: ForbiddenReason; detail: string }
  | { status: 'no_site'; sites: string[] }
  | { status: 'error'; message: string }

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function authedFetch(token: string, url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers } })
}

// Picks the verified property that covers the production site — a Domain
// property ("sc-domain:launchyournextchapter.com") is preferred since it spans
// every subdomain; falls back to a URL-prefix property on the apex or www.
export function pickSite(entries: { siteUrl: string; permissionLevel: string }[]): string | null {
  const usable = entries.filter((e) => e.permissionLevel !== 'siteUnverifiedUser')
  const domain = usable.find((e) => e.siteUrl === `sc-domain:${SITE_HOST}`)
  if (domain) return domain.siteUrl
  const prefix = usable.find((e) => {
    try {
      const host = new URL(e.siteUrl).hostname
      return host === SITE_HOST || host === `www.${SITE_HOST}`
    } catch {
      return false
    }
  })
  return prefix?.siteUrl ?? null
}

async function query(token: string, siteUrl: string, dimension: 'query' | 'page', startDate: string, endDate: string): Promise<SearchRow[]> {
  const res = await authedFetch(token, `${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    body: JSON.stringify({ startDate, endDate, dimensions: [dimension], rowLimit: 25 }),
  })
  if (!res.ok) throw new SearchConsoleHttpError(res.status, await res.text())
  const data = (await res.json()) as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }
  return (data.rows ?? []).map((r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
}

class SearchConsoleHttpError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`Search Console ${status}: ${body.slice(0, 300)}`)
  }
}

async function load(): Promise<SearchConsoleResult> {
  const connections = await getAllGoogleConnections()
  if (connections.length === 0) return { status: 'not_connected' }

  let forbidden: { reason: ForbiddenReason; detail: string } | null = null
  let lastSites: string[] = []
  for (const connection of connections) {
    try {
      const token = await getValidAccessTokenFor(connection)
      const sitesRes = await authedFetch(token, `${API}/sites`)
      if (!sitesRes.ok) throw new SearchConsoleHttpError(sitesRes.status, await sitesRes.text())
      const sites = ((await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] }).siteEntry ?? []
      const siteUrl = pickSite(sites)
      if (!siteUrl) {
        lastSites = sites.map((s) => s.siteUrl)
        continue
      }
      const end = new Date()
      const start = new Date(end.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
      const [queries, pages] = await Promise.all([
        query(token, siteUrl, 'query', isoDay(start), isoDay(end)),
        query(token, siteUrl, 'page', isoDay(start), isoDay(end)),
      ])
      return { status: 'ok', siteUrl, startDate: isoDay(start), endDate: isoDay(end), queries, pages }
    } catch (err) {
      if (err instanceof SearchConsoleHttpError && (err.status === 401 || err.status === 403)) {
        forbidden = { reason: classifyForbidden(err.status, err.body), detail: `${connection.email}: ${googleMessage(err.body)}` }
        continue
      }
      console.error('Search Console load failed:', err)
      return { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
  if (forbidden) return { status: 'needs_reconnect', ...forbidden }
  return { status: 'no_site', sites: lastSites }
}

// A working answer is cached for an hour: the data itself only updates daily
// and every admin page view would otherwise cost three Google calls. Anything
// other than "ok" is never cached (the cached function throws, which Next does
// not store), so a reconnect or a fixed setting shows up on the next load.
class NotCacheable extends Error {
  constructor(readonly result: SearchConsoleResult) {
    super('not cacheable')
  }
}

const loadCached = unstable_cache(
  async () => {
    const result = await load()
    if (result.status !== 'ok') throw new NotCacheable(result)
    return result
  },
  ['admin-search-console'],
  { revalidate: 3600, tags: ['admin-search-console'] }
)

export async function loadSearchConsole(): Promise<SearchConsoleResult> {
  try {
    return await loadCached()
  } catch (err) {
    if (err instanceof NotCacheable) return err.result
    throw err
  }
}
