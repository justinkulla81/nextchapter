import 'server-only'
import { SITE_URL } from '@/lib/seo/facts'
import { getAllGoogleConnections, getValidAccessTokenFor } from './connection'
import { pickSite } from './search-console'

// Indexing audit: samples URLs from every sitemap group and asks Google's URL
// Inspection API whether each is indexed. Google allows 2,000 inspections per
// property per day, so the sample is small (default 20 per group).

export interface AuditRow {
  group: string
  url: string
  verdict: string
  coverage: string
  lastCrawl: string
  googleCanonical: string
  userCanonical: string
  robots: string
  fetchState: string
}

// "/jobs/sitemap/3.xml" -> "jobs"; "/sitemap.xml" -> "main pages".
export function sitemapGroup(loc: string): string {
  const path = new URL(loc).pathname
  if (path === '/sitemap.xml') return 'main pages'
  return path.split('/')[1] || 'other'
}

function locs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (m) => m[1].replace(/&amp;/g, '&'))
}

function sample<T>(items: T[], n: number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

/** A sitemap that has not answered in this long contributes nothing: one slow file must not hold the whole run. */
const SITEMAP_TIMEOUT_MS = 25_000

async function sitemapUrls(only?: string): Promise<Map<string, string[]>> {
  const index = await (await fetch(`${SITE_URL}/sitemap-index.xml`, { cache: 'no-store', signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS) })).text()
  const byGroup = new Map<string, string[]>()
  for (const loc of locs(index)) byGroup.set(sitemapGroup(loc), [...(byGroup.get(sitemapGroup(loc)) ?? []), loc])
  // All groups and both shards of each at once: read one after another, 26 sitemap fetches alone used most of the time budget.
  const entries = await Promise.all(
    [...byGroup].filter(([group]) => !only || group === only).map(async ([group, maps]) => {
      // Two shards at most: a job sitemap alone is tens of thousands of URLs.
      const lists = await Promise.all(
        sample(maps, 2).map(async (map) => {
          try {
            return locs(await (await fetch(map, { cache: 'no-store', signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS) })).text())
          } catch {
            return [] // a sitemap that will not load simply contributes nothing
          }
        }),
      )
      return [group, lists.flat()] as const
    }),
  )
  return new Map(entries)
}

async function inspect(token: string, siteUrl: string, url: string): Promise<Omit<AuditRow, 'group' | 'url'>> {
  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: url, siteUrl }),
    signal: AbortSignal.timeout(20_000), // a stalled call must not hold the whole run past its deadline
  })
  if (!res.ok) {
    const text = (await res.text()).slice(0, 160)
    return { verdict: `ERROR ${res.status}`, coverage: text, lastCrawl: '', googleCanonical: '', userCanonical: '', robots: '', fetchState: '' }
  }
  const r = ((await res.json()) as { inspectionResult?: { indexStatusResult?: Record<string, string> } }).inspectionResult?.indexStatusResult ?? {}
  return {
    verdict: r.verdict ?? '',
    coverage: r.coverageState ?? '',
    lastCrawl: r.lastCrawlTime ?? '',
    googleCanonical: r.googleCanonical ?? '',
    userCanonical: r.userCanonical ?? '',
    robots: r.robotsTxtState ?? '',
    fetchState: r.pageFetchState ?? '',
  }
}

export interface AuditRun {
  rows: AuditRow[]
  /** True when the time budget ran out before every sampled URL was checked. */
  partial: boolean
  requested: number
}

/** Inspections in flight at once: 8 stays inside Google's 600-per-minute limit at about one second each. */
const CONCURRENCY = 8

/**
 * Samples `perGroup` URLs from each sitemap group (or only `onlyGroup`) and inspects them. Stops at `deadlineMs` after the start and
 * returns what it has with `partial: true`, so a slow run still ends in a file instead of a 504 (Vercel stops the function at
 * maxDuration). URLs are taken round-robin across groups, so a partial result still covers every group.
 */
export async function runIndexAudit(perGroup: number, opts: { deadlineMs?: number; onlyGroup?: string } = {}): Promise<AuditRun | { error: string }> {
  const started = Date.now()
  const deadline = started + (opts.deadlineMs ?? 200_000)
  const connections = await getAllGoogleConnections()
  for (const connection of connections) {
    try {
      const token = await getValidAccessTokenFor(connection)
      const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) })
      if (!sitesRes.ok) continue
      const siteUrl = pickSite(((await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] }).siteEntry ?? [])
      if (!siteUrl) continue
      const groups = [...(await sitemapUrls(opts.onlyGroup))].map(([group, urls]) => sample(urls, perGroup).map((url) => ({ group, url })))
      const picks: { group: string; url: string }[] = []
      for (let i = 0; i < perGroup; i++) for (const g of groups) if (g[i]) picks.push(g[i])
      const rows: AuditRow[] = []
      for (let i = 0; i < picks.length && Date.now() < deadline; i += CONCURRENCY) {
        const done = await Promise.all(picks.slice(i, i + CONCURRENCY).map(async (p) => ({ ...p, ...(await inspect(token, siteUrl, p.url)) })))
        rows.push(...done)
      }
      return { rows, partial: rows.length < picks.length, requested: picks.length }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
  return { error: 'No connected Google account can see the launchyournextchapter.com property.' }
}

export function auditCsv(rows: AuditRow[]): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
  const head = 'group,url,verdict,coverage,last_crawl,google_canonical,user_canonical,robots,fetch_state'
  return [head, ...rows.map((r) => [r.group, r.url, r.verdict, r.coverage, r.lastCrawl, r.googleCanonical, r.userCanonical, r.robots, r.fetchState].map(cell).join(','))].join('\n')
}

export interface AuditDiagnostics {
  connections: number
  siteUrl: string | null
  groups: { group: string; urls: number }[]
  /** How long each stage took, in milliseconds. */
  ms: { connection: number; sitemaps: number }
}

/**
 * What an audit run would use, without inspecting anything: the Google connection, the property, and the URLs found in each sitemap
 * group. It answers in seconds, so a stuck stage shows up here instead of as a spinning page.
 */
export async function auditDiagnostics(onlyGroup?: string): Promise<AuditDiagnostics | { error: string }> {
  const t0 = Date.now()
  try {
    const connections = await getAllGoogleConnections()
    for (const connection of connections) {
      const token = await getValidAccessTokenFor(connection)
      const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) })
      if (!sitesRes.ok) continue
      const siteUrl = pickSite(((await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] }).siteEntry ?? [])
      if (!siteUrl) continue
      const t1 = Date.now()
      const groups = [...(await sitemapUrls(onlyGroup))].map(([group, urls]) => ({ group, urls: urls.length }))
      return { connections: connections.length, siteUrl, groups, ms: { connection: t1 - t0, sitemaps: Date.now() - t1 } }
    }
    return { error: `No connected Google account can see the property (${connections.length} connections tried, ${Date.now() - t0} ms).` }
  } catch (err) {
    return { error: `${err instanceof Error ? err.message : 'Unknown error'} (${Date.now() - t0} ms)` }
  }
}
