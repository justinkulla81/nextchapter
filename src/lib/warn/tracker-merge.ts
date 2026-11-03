import { plausibleEmployer } from '@/lib/linkedin/layoff-post-rules'
import { sameEmployer } from './news-headline'
import { affectedRoles } from './affected-roles'

// Reported layoffs that name no U.S. state (a news story, an SEC filing) for the public tracker. Pure.
//
// One layoff is often reported by several outlets, each filed as its own notice with its own spelling of the employer,
// date and headcount. They are merged into one line, and where the reports disagree the headcount most of them give wins.

export interface LooseNotice {
  id: string
  employer: string
  normalizedEmployer: string
  companyId: string | null
  employees: number | null
  noticeDate: Date
  effectiveDate: Date | null
  layoffType: string | null
  sourceUrl: string | null
  /** Publishers named in the news mentions linked to this notice. */
  publishers: string[]
  /** ISO country of the job cuts, when known. */
  country: string | null
  /** The matched company's industry, when known. */
  industry: string | null
  /** Headlines of the news mentions linked to this notice. */
  headlines?: string[]
  /** The story links of the news mentions linked to this notice, with the outlet that ran each. */
  mentions?: { publisher: string | null; url: string }[]
  division?: string | null
}

export interface MergedLayoff {
  key: string
  employer: string
  normalizedEmployer: string
  employees: number | null
  noticeDate: Date
  effectiveDate: Date | null
  layoffType: string | null
  sourceUrl: string | null
  /** Distinct sources that reported it. One is unconfirmed. */
  sources: number
  country: string | null
  industry: string | null
  /** A publisher that reported it, for the source label when the link is a redirector. */
  publisher: string | null
  /** Employee groups the headlines name; empty when none. */
  roles: string[]
  division: string | null
  /** Up to three distinct outlets that reported it, with a link to each story. */
  links: { label: string; url: string }[]
}

export const MAX_SOURCE_LINKS = 3

export const MERGE_WINDOW_DAYS = 45
const DAY_MS = 86_400_000

const hostOf = (url: string | null): string | null => {
  if (!url) return null
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase() } catch { return null }
}
/** Google News links hide the publisher: the host says nothing, so each such link counts as its own source. */
const isRedirector = (url: string | null) => hostOf(url) === 'news.google.com'

/**
 * Distinct publishers across the reports. A notice's own link is counted only when no publisher is named anywhere: it is
 * usually the same outlet as a named publisher, and counting both would make every story look confirmed.
 */
function sourcesOf(rows: LooseNotice[]): number {
  const publishers = new Set<string>()
  for (const r of rows) {
    // "Reuters on MSN" is Reuters, syndicated; it is not a second publisher.
    for (const p of r.publishers) if (p.trim()) publishers.add(p.trim().toLowerCase().replace(/\s+on\s+msn$/, '').replace(/^www\./, ''))
  }
  if (publishers.size > 0) return publishers.size
  const links = new Set<string>()
  for (const r of rows) {
    const host = hostOf(r.sourceUrl)
    if (host) links.add(isRedirector(r.sourceUrl) ? `link:${r.sourceUrl}` : host)
  }
  return links.size
}

/** One link per outlet, up to three: a story from each distinct publisher, falling back to the notices' own links. */
function sourceLinks(rows: LooseNotice[]): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = []
  const seen = new Set<string>()
  const add = (label: string | null, url: string | null) => {
    if (!url || !/^https:\/\//.test(url) || out.length >= MAX_SOURCE_LINKS) return
    const raw = (label ?? (isRedirector(url) ? 'Google News' : hostOf(url)) ?? '').trim().replace(/\s+on\s+msn$/i, '')
    const name = /^(www\.)?news\.google\.com$/i.test(raw) ? 'Google News' : raw
    const key = name.toLowerCase().replace(/^www\./, '')
    if (!name || seen.has(key)) return
    seen.add(key)
    out.push({ label: name, url })
  }
  for (const r of rows) for (const m of r.mentions ?? []) add(m.publisher, m.url)
  for (const r of rows) add(isRedirector(r.sourceUrl) ? 'Google News' : hostOf(r.sourceUrl), r.sourceUrl)
  for (const r of rows) for (const m of r.mentions ?? []) if (hostOf(m.url) === 'news.google.com') add('Google News', m.url)
  return out
}

/** The headcount most reports give; on a tie the smaller, so the tracker never overstates. Null when none gave one. */
export function agreedHeadcount(values: (number | null)[]): number | null {
  const counts = new Map<number, number>()
  for (const v of values) if (v != null && v > 0) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: number | null = null
  for (const [value, n] of counts) {
    if (best === null || n > counts.get(best)! || (n === counts.get(best) && value < best)) best = value
  }
  return best
}

/**
 * A name a reader would recognise as an employer. News headlines yield descriptions as well as names ("N.J. bank", "Atlanta
 * mortgage lender", "San Francisco HQ", "AT&T and Verizon normalize"); a name that ends in a plain lowercase word or in "HQ"
 * is one of those. The public page shows only names, so a description is left out rather than printed.
 */
export function looksLikeEmployer(name: string): boolean {
  if (!plausibleEmployer(name)) return false
  const last = name.trim().split(/\s+/).pop() ?? ''
  return !/^[a-z]{3,}$/.test(last) && !/^(hq|headquarters)$/i.test(last)
}

export function mergeReported(notices: LooseNotice[]): MergedLayoff[] {
  const clusters: LooseNotice[][] = []
  const sorted = notices.filter((n) => looksLikeEmployer(n.employer)).sort((a, b) => a.noticeDate.getTime() - b.noticeDate.getTime())
  for (const n of sorted) {
    const home = clusters.find((c) =>
      Math.abs(c[0].noticeDate.getTime() - n.noticeDate.getTime()) <= MERGE_WINDOW_DAYS * DAY_MS
      && ((n.companyId && c.some((m) => m.companyId === n.companyId)) || c.some((m) => sameEmployer(m.normalizedEmployer, n.normalizedEmployer))))
    if (home) home.push(n)
    else clusters.push([n])
  }

  return clusters.map((rows) => {
    const employees = agreedHeadcount(rows.map((r) => r.employees))
    const chosen = rows.find((r) => r.employees === employees && r.sourceUrl && !isRedirector(r.sourceUrl))
      ?? rows.find((r) => r.employees === employees)
      ?? rows[0]
    const link = chosen.sourceUrl && !isRedirector(chosen.sourceUrl) ? chosen.sourceUrl : (rows.find((r) => r.sourceUrl && !isRedirector(r.sourceUrl))?.sourceUrl ?? chosen.sourceUrl)
    const effective = rows.map((r) => r.effectiveDate).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null
    return {
      key: rows[0].id,
      employer: chosen.employer,
      normalizedEmployer: rows[0].normalizedEmployer,
      employees,
      noticeDate: rows[0].noticeDate,
      effectiveDate: effective,
      layoffType: chosen.layoffType,
      sourceUrl: link,
      sources: sourcesOf(rows),
      country: rows.find((r) => r.country)?.country ?? null,
      industry: rows.find((r) => r.industry)?.industry ?? null,
      publisher: rows.flatMap((r) => r.publishers).find((p) => p.trim())?.trim().replace(/\s+on\s+msn$/i, '') ?? null,
      roles: affectedRoles(rows.flatMap((r) => r.headlines ?? [])),
      division: rows.find((r) => r.division)?.division ?? null,
      links: sourceLinks(rows),
    }
  })
}

/**
 * The kind line for a reported layoff. The news job's own wording ("Reported by 1 publisher — unconfirmed") is about how it
 * found the story, not about the layoff, and the page shows the source count itself; what is kept is the share of staff
 * and an SEC filing's type.
 */
export function reportedKind(layoffType: string | null): string | null {
  if (!layoffType) return null
  if (/^SEC 8-K/i.test(layoffType)) return layoffType.trim()
  const percent = layoffType.match(/(\d{1,3})% of staff/)?.[1]
  return percent ? `${percent}% of staff` : null
}
