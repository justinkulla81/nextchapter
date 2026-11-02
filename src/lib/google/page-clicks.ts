import 'server-only'
import { getAllGoogleConnections, getValidAccessTokenFor } from './connection'
import { pickSite } from './search-console'

// Search Console clicks, impressions and average position per page for one section of the site (a path prefix), for the title tests.
// Read-only, the same webmasters.readonly grant as the Search queries page. Pages with no impressions in the window are not returned.

const API = 'https://www.googleapis.com/webmasters/v3'
const PAGE_SIZE = 25000
const MAX_PAGES = 8

export interface PageClicks {
  path: string
  clicks: number
  impressions: number
  position: number
}

export type PageClicksResult = { status: 'ok'; rows: PageClicks[]; truncated: boolean } | { status: 'unavailable'; message: string }

export async function pageClicks(pathPrefix: string, startDate: string, endDate: string): Promise<PageClicksResult> {
  const connections = await getAllGoogleConnections()
  if (connections.length === 0) return { status: 'unavailable', message: 'No Google account is connected.' }
  let message = 'No connected account can see the launchyournextchapter.com property.'
  for (const connection of connections) {
    try {
      const token = await getValidAccessTokenFor(connection)
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const sitesRes = await fetch(`${API}/sites`, { headers })
      if (!sitesRes.ok) throw new Error(`Search Console ${sitesRes.status}`)
      const sites = ((await sitesRes.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] }).siteEntry ?? []
      const siteUrl = pickSite(sites)
      if (!siteUrl) continue
      const rows: PageClicks[] = []
      let truncated = false
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await fetch(`${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ['page'],
            dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: pathPrefix }] }],
            rowLimit: PAGE_SIZE,
            startRow: page * PAGE_SIZE,
          }),
        })
        if (!res.ok) throw new Error(`Search Console ${res.status}: ${(await res.text()).slice(0, 200)}`)
        const data = ((await res.json()) as { rows?: { keys: string[]; clicks: number; impressions: number; position: number }[] }).rows ?? []
        for (const r of data) {
          let path = ''
          try {
            path = new URL(r.keys[0]).pathname
          } catch {
            continue
          }
          if (path.startsWith(pathPrefix)) rows.push({ path, clicks: r.clicks, impressions: r.impressions, position: r.position })
        }
        if (data.length < PAGE_SIZE) break
        if (page === MAX_PAGES - 1) truncated = true
      }
      return { status: 'ok', rows, truncated }
    } catch (err) {
      message = err instanceof Error ? err.message : 'Unknown error'
    }
  }
  return { status: 'unavailable', message }
}
