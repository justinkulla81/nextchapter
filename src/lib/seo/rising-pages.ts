import type { PerfRow } from '@/lib/seo/search-analysis'

// Pages that Google already shows on the edge of page one (average position 8 to 20) for a real search. A link from a busy page to
// these is the cheapest ranking help we have, and the link text is the search itself. Pure: it reads Search Console rows.

export interface RisingPage {
  path: string
  /** The search that showed this page most, as typed. */
  query: string
  impressions: number
  /** Impression-weighted average position. */
  position: number
}

/** The page types worth linking to: one company layoff page, one job-title hub, one employer page. */
export const RISING_PREFIXES = ['/layoffs/company/', '/jobs/title/', '/employers/'] as const

export interface RisingOptions {
  prefixes?: readonly string[]
  minImpressions?: number
  fromPosition?: number
  toPosition?: number
  limit: number
}

/** A search worth showing as link text: plain words, not a search operator, a question about whether a company is real, or a pointer to another site. */
const NOT_LINK_TEXT = /[:/@"]|\b(legit|scam|reddit|glassdoor|indeed|linkedin|login|log in|sign in|reviews?|complaints?|phone number|address)\b/i
export const usableQuery = (q: string): boolean => q.length >= 3 && q.length <= 60 && !NOT_LINK_TEXT.test(q)

function pathOf(page: string): string | null {
  try {
    return new URL(page).pathname.replace(/\/+$/, '')
  } catch {
    return null
  }
}

export function risingPages(rows: PerfRow[], opts: RisingOptions): RisingPage[] {
  const prefixes = opts.prefixes ?? RISING_PREFIXES
  const from = opts.fromPosition ?? 8
  const to = opts.toPosition ?? 20
  const min = opts.minImpressions ?? 10
  const by = new Map<string, { impressions: number; weighted: number; top: { query: string; impressions: number } }>()
  for (const r of rows) {
    const path = pathOf(r.page)
    if (!path) continue
    const prefix = prefixes.find((p) => path.startsWith(p))
    // exactly one segment after the prefix: not a page inside a page (/jobs/title/data-analyst/chicago)
    if (!prefix || path.length === prefix.length || path.slice(prefix.length).includes('/')) continue
    const e = by.get(path) ?? { impressions: 0, weighted: 0, top: { query: '', impressions: -1 } }
    e.impressions += r.impressions
    e.weighted += r.position * r.impressions
    if (usableQuery(r.query) && r.impressions > e.top.impressions) e.top = { query: r.query, impressions: r.impressions }
    by.set(path, e)
  }
  const out: RisingPage[] = []
  for (const [path, e] of by) {
    const position = e.impressions > 0 ? e.weighted / e.impressions : 0
    if (!e.top.query || e.impressions < min || position < from || position > to) continue
    out.push({ path, query: e.top.query, impressions: e.impressions, position })
  }
  return out.sort((a, b) => b.impressions - a.impressions || (a.path < b.path ? -1 : 1)).slice(0, opts.limit)
}
