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

export interface ExportRow {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

const EXPORT_DAYS = 480 // Search Console keeps 16 months
const EXPORT_PAGE = 25000
const EXPORT_MAX_ROWS = 200000

// Every search term Google reports for the property, up to 16 months back,
// paged 25,000 at a time. Not cached: it is a one-off download, not a page view.
export async function exportSearchTerms(): Promise<{ siteUrl: string; startDate: string; endDate: string; rows: ExportRow[] } | { error: string }> {
  const connections = await getAllGoogleConnections()
  if (connections.length === 0) return { error: 'No Google account is connected.' }
  let lastError = 'No connected account can see the launchyournextchapter.com property.'
  for (const connection of connections) {
    try {
      const token = await getValidAccessTokenFor(connection)
      const sitesRes = await authedFetch(token, `${API}/sites`)
      if (!sitesRes.ok) throw new SearchConsoleHttpError(sitesRes.status, await sitesRes.text())
      const sites = ((await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] }).siteEntry ?? []
      const siteUrl = pickSite(sites)
      if (!siteUrl) continue
      const end = new Date()
      const start = new Date(end.getTime() - EXPORT_DAYS * 24 * 60 * 60 * 1000)
      const rows: ExportRow[] = []
      for (let startRow = 0; startRow < EXPORT_MAX_ROWS; startRow += EXPORT_PAGE) {
        const res = await authedFetch(token, `${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
          method: 'POST',
          body: JSON.stringify({ startDate: isoDay(start), endDate: isoDay(end), dimensions: ['query'], rowLimit: EXPORT_PAGE, startRow }),
        })
        if (!res.ok) throw new SearchConsoleHttpError(res.status, await res.text())
        const page = ((await res.json()) as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }).rows ?? []
        for (const r of page) rows.push({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })
        if (page.length < EXPORT_PAGE) break
      }
      return { siteUrl, startDate: isoDay(start), endDate: isoDay(end), rows }
    } catch (err) {
      lastError = err instanceof SearchConsoleHttpError ? `Google said ${googleMessage(err.body)}` : err instanceof Error ? err.message : 'Unknown error'
    }
  }
  return { error: lastError }
}

// One search term per row. A term that starts with = + - or @ is prefixed so a
// spreadsheet reads it as text, not a formula.
export function searchTermsCsv(rows: ExportRow[]): string {
  const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`
  const lines = rows.map((r) => [cell(r.query), r.clicks, r.impressions, (r.ctr * 100).toFixed(2), r.position.toFixed(1)].join(','))
  return ['query,clicks,impressions,ctr_percent,avg_position', ...lines].join('\n')
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

export interface StrikingRow {
  query: string
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

const STRIKING_MIN_POSITION = 8
const STRIKING_MAX_POSITION = 20
const STRIKING_MIN_IMPRESSIONS = 10

/**
 * Query and page pairs that rank just off page one (average position 8 to 20 over the last 28 days) and are seen often
 * enough to matter. Rewriting the page's title and description for these queries is the cheapest traffic win.
 * Not cached: it is read by hand, a few times a week.
 */
export async function strikingDistance(): Promise<{ siteUrl: string; startDate: string; endDate: string; rows: StrikingRow[] } | { error: string }> {
  const connections = await getAllGoogleConnections()
  if (connections.length === 0) return { error: 'No Google account is connected.' }
  let lastError = 'No connected account can see the launchyournextchapter.com property.'
  for (const connection of connections) {
    try {
      const token = await getValidAccessTokenFor(connection)
      const sitesRes = await authedFetch(token, `${API}/sites`)
      if (!sitesRes.ok) throw new SearchConsoleHttpError(sitesRes.status, await sitesRes.text())
      const sites = ((await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] }).siteEntry ?? []
      const siteUrl = pickSite(sites)
      if (!siteUrl) continue
      const end = new Date()
      const start = new Date(end.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
      const res = await authedFetch(token, `${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST',
        body: JSON.stringify({ startDate: isoDay(start), endDate: isoDay(end), dimensions: ['query', 'page'], rowLimit: 25000 }),
      })
      if (!res.ok) throw new SearchConsoleHttpError(res.status, await res.text())
      const data = ((await res.json()) as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }).rows ?? []
      const rows = data
        .map((r) => ({ query: r.keys[0], page: r.keys[1], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
        .filter((r) => r.position >= STRIKING_MIN_POSITION && r.position <= STRIKING_MAX_POSITION && r.impressions >= STRIKING_MIN_IMPRESSIONS)
        .sort((a, b) => b.impressions - a.impressions)
      return { siteUrl, startDate: isoDay(start), endDate: isoDay(end), rows }
    } catch (err) {
      lastError = err instanceof SearchConsoleHttpError ? `Google said ${googleMessage(err.body)}` : err instanceof Error ? err.message : 'Unknown error'
    }
  }
  return { error: lastError }
}

export type IndexState = 'indexed' | 'not_indexed' | 'unknown'

const INSPECT_API = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect'

async function searchConsoleSession(): Promise<{ token: string; siteUrl: string } | { error: string }> {
  const connections = await getAllGoogleConnections()
  if (connections.length === 0) return { error: 'No Google account is connected.' }
  let lastError = 'No connected account can see the launchyournextchapter.com property.'
  for (const connection of connections) {
    try {
      const token = await getValidAccessTokenFor(connection)
      const sitesRes = await authedFetch(token, `${API}/sites`)
      if (!sitesRes.ok) throw new SearchConsoleHttpError(sitesRes.status, await sitesRes.text())
      const sites = ((await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] }).siteEntry ?? []
      const siteUrl = pickSite(sites)
      if (siteUrl) return { token, siteUrl }
    } catch (err) {
      lastError = err instanceof SearchConsoleHttpError ? `Google said ${googleMessage(err.body)}` : err instanceof Error ? err.message : 'Unknown error'
    }
  }
  return { error: lastError }
}

// One page's state from Google's URL inspection API. Throws on any failure so unstable_cache never stores a guess; cached six hours,
// because a page's state changes slowly and the API allows 2,000 inspections a day for the property.
const inspectOne = unstable_cache(
  async (url: string): Promise<IndexState> => {
    const session = await searchConsoleSession()
    if ('error' in session) throw new Error(session.error)
    const res = await authedFetch(session.token, INSPECT_API, { method: 'POST', body: JSON.stringify({ inspectionUrl: url, siteUrl: session.siteUrl }) })
    if (!res.ok) throw new SearchConsoleHttpError(res.status, await res.text())
    const data = (await res.json()) as { inspectionResult?: { indexStatusResult?: { verdict?: string } } }
    const verdict = data.inspectionResult?.indexStatusResult?.verdict
    if (!verdict) throw new Error('No verdict in the inspection result.')
    return verdict === 'PASS' ? 'indexed' : 'not_indexed'
  },
  ['gsc-index-state-v1'],
  { revalidate: 6 * 60 * 60 },
)

/** Whether Google has each page, for the daily indexing picks. A failed lookup is 'unknown', which the picks treat as not indexed. */
export async function inspectIndexState(urls: string[]): Promise<Map<string, IndexState>> {
  const out = new Map<string, IndexState>()
  const queue = [...urls]
  async function worker() {
    for (let url = queue.shift(); url; url = queue.shift()) {
      out.set(url, await inspectOne(url).catch(() => 'unknown' as IndexState))
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker))
  return out
}

export interface SitemapProblems {
  /** Job sitemap files Google lists for the property, and the errors and warnings it reports on them. */
  files: number
  errors: number
  warnings: number
  /** URLs submitted in the job sitemaps (what Google read). */
  submitted: number
}

/**
 * Google's own report on our job sitemaps, from the Search Console sitemaps API with the Google grant already stored for the admin
 * (no new credentials). The index-coverage errors (404, 5xx) are not in any API, so they stay a manual read of the Pages report.
 */
export async function sitemapProblems(): Promise<SitemapProblems> {
  const session = await searchConsoleSession()
  if ('error' in session) throw new Error(session.error)
  const res = await authedFetch(session.token, `${API}/sites/${encodeURIComponent(session.siteUrl)}/sitemaps`)
  if (!res.ok) throw new SearchConsoleHttpError(res.status, await res.text())
  const data = (await res.json()) as { sitemap?: { path: string; errors?: string; warnings?: string; contents?: { type: string; submitted?: string }[] }[] }
  const jobs = (data.sitemap ?? []).filter((m) => /\/jobs\/sitemap\//.test(m.path))
  return {
    files: jobs.length,
    errors: jobs.reduce((n, m) => n + Number(m.errors ?? 0), 0),
    warnings: jobs.reduce((n, m) => n + Number(m.warnings ?? 0), 0),
    submitted: jobs.reduce((n, m) => n + (m.contents ?? []).reduce((k, c) => k + Number(c.submitted ?? 0), 0), 0),
  }
}
