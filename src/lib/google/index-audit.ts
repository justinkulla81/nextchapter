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

async function sitemapUrls(): Promise<Map<string, string[]>> {
  const index = await (await fetch(`${SITE_URL}/sitemap-index.xml`, { cache: 'no-store' })).text()
  const byGroup = new Map<string, string[]>()
  for (const loc of locs(index)) byGroup.set(sitemapGroup(loc), [...(byGroup.get(sitemapGroup(loc)) ?? []), loc])
  const urls = new Map<string, string[]>()
  for (const [group, maps] of byGroup) {
    // Two shards at most: a job sitemap alone is tens of thousands of URLs.
    const found: string[] = []
    for (const map of sample(maps, 2)) {
      try {
        const xml = await (await fetch(map, { cache: 'no-store' })).text()
        found.push(...locs(xml))
      } catch {
        // a sitemap that will not load simply contributes nothing
      }
    }
    urls.set(group, found)
  }
  return urls
}

async function inspect(token: string, siteUrl: string, url: string): Promise<Omit<AuditRow, 'group' | 'url'>> {
  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: url, siteUrl }),
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

export async function runIndexAudit(perGroup: number): Promise<AuditRow[] | { error: string }> {
  const connections = await getAllGoogleConnections()
  for (const connection of connections) {
    try {
      const token = await getValidAccessTokenFor(connection)
      const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: { Authorization: `Bearer ${token}` } })
      if (!sitesRes.ok) continue
      const siteUrl = pickSite(((await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] }).siteEntry ?? [])
      if (!siteUrl) continue
      const picks: { group: string; url: string }[] = []
      for (const [group, urls] of await sitemapUrls()) for (const url of sample(urls, perGroup)) picks.push({ group, url })
      const rows: AuditRow[] = []
      // Five at a time: well inside Google's 600-per-minute limit.
      for (let i = 0; i < picks.length; i += 5) {
        const batch = picks.slice(i, i + 5)
        const done = await Promise.all(batch.map(async (p) => ({ ...p, ...(await inspect(token, siteUrl, p.url)) })))
        rows.push(...done)
      }
      return rows
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
