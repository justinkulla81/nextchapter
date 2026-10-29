// Which layoff pages to ask a search engine to look at today: the latest layoffs first, then the rest of the layoff pages
// that were never asked about, until the day's list is full. Pure: it reads the public sitemap entries and a record of what
// was already asked, so the daily Google Search Console run (scripts/seo/daily-index-list.ts) and the daily Bing submission
// (src/lib/syndication/bing-submit.ts) choose the same way.

export const DAILY_LIST_SIZE = 10
/** A page counts as "the latest" when its newest layoff is this recent. */
export const LATEST_WINDOW_DAYS = 7

export interface SitemapEntry {
  url: string
  /** The sitemap's lastmod, as written. */
  lastmod: string | null
}

/** url -> ISO time it was last asked about. */
export type Requested = Record<string, string>

export interface DailyPick {
  url: string
  reason: 'latest' | 'backfill'
}

const SITE = 'https://launchyournextchapter.com'
const NOT_STATES = new Set(['week', 'this-week', 'by-state', 'company'])

export function parseSitemapEntries(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = []
  for (const block of xml.split('<url>').slice(1)) {
    const url = /<loc>([^<]+)<\/loc>/.exec(block)?.[1]?.trim()
    if (!url) continue
    out.push({ url, lastmod: /<lastmod>([^<]+)<\/lastmod>/.exec(block)?.[1]?.trim() ?? null })
  }
  return out
}

type Kind = 'hub' | 'company' | 'state' | 'other'

/** What kind of layoff page a URL is, or null when it is not one. */
export function layoffKind(url: string): Kind | null {
  if (!url.startsWith(`${SITE}/layoffs`)) return null
  const path = url.slice(SITE.length)
  if (path === '/layoffs') return 'hub'
  if (/^\/layoffs\/company\/[a-z0-9-]+$/.test(path)) return 'company'
  const m = /^\/layoffs\/([a-z0-9-]+)$/.exec(path)
  if (m) return NOT_STATES.has(m[1]) ? 'other' : 'state'
  return /^\/layoffs\/(week|this-week|by-state)(\/[a-z0-9-]+)?$/.test(path) ? 'other' : null
}

const day = (iso: string | null): number | null => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? null : Math.floor(t / 86_400_000)
}

/** Backfill order: company pages, then state pages, then the hub and the rest. */
const RANK: Record<Kind, number> = { company: 0, state: 1, hub: 2, other: 3 }

/**
 * Up to `n` layoff pages to ask about today.
 *  latest:   changed in the last LATEST_WINDOW_DAYS days and not asked about since that change, newest change first
 *  backfill: never asked about, company pages first, newest layoff first
 * A page asked about before is asked about again only when its newest layoff is on a later day than the last ask.
 */
export function pickDailyList(entries: SitemapEntry[], requested: Requested, n: number = DAILY_LIST_SIZE, now: number = Date.now()): DailyPick[] {
  const today = Math.floor(now / 86_400_000)
  const pages = entries.flatMap((e) => {
    const kind = layoffKind(e.url)
    return kind ? [{ ...e, kind, mod: day(e.lastmod) }] : []
  })
  const asked = (url: string) => day(requested[url] ?? null)
  const latest = pages
    .filter((p) => p.mod !== null && today - p.mod <= LATEST_WINDOW_DAYS && (asked(p.url) === null || p.mod > asked(p.url)!))
    .sort((a, b) => b.mod! - a.mod! || RANK[a.kind] - RANK[b.kind] || (a.url < b.url ? -1 : 1))
    .slice(0, n)
  const taken = new Set(latest.map((p) => p.url))
  const backfill = pages
    .filter((p) => !taken.has(p.url) && requested[p.url] === undefined)
    .sort((a, b) => RANK[a.kind] - RANK[b.kind] || (b.mod ?? -1) - (a.mod ?? -1) || (a.url < b.url ? -1 : 1))
    .slice(0, Math.max(0, n - latest.length))
  return [
    ...latest.map((p) => ({ url: p.url, reason: 'latest' as const })),
    ...backfill.map((p) => ({ url: p.url, reason: 'backfill' as const })),
  ]
}
