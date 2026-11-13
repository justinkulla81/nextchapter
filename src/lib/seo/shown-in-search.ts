import 'server-only'
import { unstable_cache } from 'next/cache'
import { getAllGoogleConnections, getValidAccessTokenFor } from '@/lib/google/connection'
import { pickSite } from '@/lib/google/search-console'

// The pages Google is already showing in search: any page with an impression in the last 28 days (Search Console, by page). A page
// Google shows is never hidden by one of our quality bars (noindex, out of a sitemap): on 2026-11-13 the conference bar had set
// noindex on pages ranking around position 8 to 9 ("mema annual conference 2026", 109 impressions). See CLAUDE.md, search indexing.
//
// Read from Google, not our database: one Search Console call (plus the site list) every 6 hours, shared by every server through the
// data cache. Any failure returns an empty list, which leaves every page as its own bar decides.

const API = 'https://www.googleapis.com/webmasters/v3'
const DAY_MS = 86_400_000

/** "/conferences/mema-annual-conference" for "https://launchyournextchapter.com/conferences/mema-annual-conference?x=1". */
export function searchPath(url: string): string | null {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/+$/, '')
    return path || '/'
  } catch {
    return null
  }
}

async function load(): Promise<string[]> {
  const end = new Date(Date.now() - 2 * DAY_MS).toISOString().slice(0, 10)
  const start = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10)
  for (const connection of await getAllGoogleConnections()) {
    try {
      const token = await getValidAccessTokenFor(connection)
      const sitesRes = await fetch(`${API}/sites`, { headers: { Authorization: `Bearer ${token}` } })
      if (!sitesRes.ok) continue
      const siteUrl = pickSite(((await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] }).siteEntry ?? [])
      if (!siteUrl) continue
      const res = await fetch(`${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['page'], rowLimit: 25000, dataState: 'all' }),
      })
      if (!res.ok) continue
      const rows = ((await res.json()) as { rows?: { keys?: string[]; impressions: number }[] }).rows ?? []
      return [...new Set(rows.filter((r) => r.impressions > 0).map((r) => searchPath(r.keys?.[0] ?? '')).filter((p): p is string => !!p))]
    } catch (error) {
      console.error('shown-in-search: Search Console read failed', error instanceof Error ? error.message : String(error))
    }
  }
  return []
}

const cached = unstable_cache(load, ['shown-in-search-v1'], { revalidate: 6 * 3600 })

/** Paths Google showed in search in the last 28 days. Empty when Search Console cannot be read. */
export async function pagesShownInSearch(): Promise<Set<string>> {
  return new Set(await cached().catch(() => [] as string[]))
}

/** Whether Google showed this path in search in the last 28 days. A quality bar never sets noindex on one that it did. */
export async function shownInSearch(path: string): Promise<boolean> {
  return (await pagesShownInSearch()).has(path.replace(/\/+$/, '') || '/')
}
