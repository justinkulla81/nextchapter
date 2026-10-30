import { pausedPrefixes } from '@/lib/paused-pages'

// A lightly visited page is rendered on its first request and cached after that (0.4 to 2.0 s the first time, 0.1 to 0.45 s
// after: docs/SPEED_AUDIT_2026_10.md). Googlebot is most often that first request. The page-warmup cron asks for a few
// hundred of these pages a day so the first real visit is a cache hit.
//
// It reads the live sitemaps over HTTP (already cached for six hours), not the database, and asks for the pages one at a time.

export const WARM_TYPES = [
  { key: 'employer', pattern: /^\/employers\/[^/]+$/ },
  { key: 'job-title', pattern: /^\/jobs\/title\/[^/]+$/ },
  { key: 'salary', pattern: /^\/salaries\/[^/]+$/ },
  { key: 'place-city', pattern: /^\/places\/[^/]+\/city\/[^/]+$/ },
  { key: 'unemployment-state', pattern: /^\/unemployment-benefits\/[^/]+$/ },
  { key: 'nonprofits-state', pattern: /^\/nonprofits\/[^/]+$/ },
] as const

export type WarmTypeKey = (typeof WARM_TYPES)[number]['key']

export const WARM_PER_RUN = 300
export const WARM_GAP_MS = 250
export const WARM_REQUEST_TIMEOUT_MS = 20_000

/** The `<loc>` addresses in a sitemap or sitemap index. */
export function parseLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'))
}

/** Whole days since 1970-01-01 (UTC): the same on every instance, so a run picks the same window wherever it lands. */
export const dayNumber = (now: Date) => Math.floor(now.getTime() / 86_400_000)

/** `perType` addresses of `list`, starting where yesterday's run stopped and wrapping round the end. */
export function windowOf<T>(list: T[], day: number, perType: number): T[] {
  if (!list.length) return []
  const n = Math.min(perType, list.length)
  const start = (day * perType) % list.length
  return Array.from({ length: n }, (_, i) => list[(start + i) % list.length])
}

/** Paths (not full addresses) of each warmed type found in `urls`, in sitemap order, without duplicates. */
export function groupByType(urls: string[], siteUrl: string): Record<WarmTypeKey, string[]> {
  const out = Object.fromEntries(WARM_TYPES.map((t) => [t.key, [] as string[]])) as Record<WarmTypeKey, string[]>
  const seen = new Set<string>()
  for (const u of urls) {
    if (!u.startsWith(siteUrl)) continue
    const path = u.slice(siteUrl.length) || '/'
    if (seen.has(path)) continue
    const t = WARM_TYPES.find((x) => x.pattern.test(path))
    if (!t) continue
    seen.add(path)
    out[t.key].push(path)
  }
  return out
}

/** The addresses to ask for today: an equal share per type, none under a section that is switched off (PAUSE_HEAVY_PAGES). */
export function pickWarmPaths(grouped: Record<WarmTypeKey, string[]>, day: number, total = WARM_PER_RUN, paused = pausedPrefixes()): string[] {
  const perType = Math.ceil(total / WARM_TYPES.length)
  const out: string[] = []
  for (const t of WARM_TYPES) {
    const list = grouped[t.key].filter((p) => !paused.some((prefix) => p === prefix || p.startsWith(`${prefix}/`)))
    out.push(...windowOf(list, day, perType))
  }
  return out.slice(0, total)
}

/** The sitemap files to read today. The employer files are 10,000 addresses each, so one a day, in turn. */
export function sitemapsToRead(indexLocs: string[], siteUrl: string, day: number): string[] {
  const employerShards = indexLocs.filter((l) => l.includes('/employers/sitemap/'))
  const fixed = [`${siteUrl}/sitemap.xml`, `${siteUrl}/places/sitemap.xml`, `${siteUrl}/salaries/sitemap.xml`]
  return employerShards.length ? [...fixed, employerShards[day % employerShards.length]] : fixed
}
