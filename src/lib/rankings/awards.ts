// "Awards": where a place sits in each monthly ranking, kept for every month so a page can say "October 2026: #4 for junior
// jobs, September 2026: #3". Pure helpers: the stored shape, how an edition becomes awards, how awards are merged and grouped,
// and how a job family is matched to the lists about it. No I/O here (store.ts reads and writes the buckets).

import { FAMILIES, editionLabel } from '@/lib/rankings/build-edition'
import type { RankingEdition, RankingIndexEntry } from '@/lib/rankings/types'

/** One placing: the list, the month, the rank and the figure. The title is not stored (the ranking index has it). */
export interface Award { slug: string; edition: string; rank: number; valueLabel: string; places: number }
/** Entity key (a city "ST|city" or a county FIPS) to its awards. */
export type AwardBook = Record<string, Award[]>

/** An award with what a page needs to show it. */
export interface AwardView extends Award { title: string; href: string; month: string }

export const AWARD_TOP = 25
export const AWARD_MONTHS = 24
/** The book is split into this many stored rows, so a page reads about 1/32 of it. */
export const AWARD_BUCKETS = 32

export function bucketOf(key: string): number {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % AWARD_BUCKETS
}

/** The awards one edition hands out: its top 25 cities, counties, industries, AI skills, tools or certifications. */
export function awardEntries(ed: Pick<RankingEdition, 'slug' | 'edition' | 'rows'>): [string, Award][] {
  return ed.rows.slice(0, AWARD_TOP).map((r) => [r.key, { slug: ed.slug, edition: ed.edition, rank: r.rank, valueLabel: r.valueLabel, places: ed.rows.length }])
}

const monthsBefore = (edition: string, n: number) => {
  const [y, m] = edition.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 - n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Adds awards to a book. A (list, month) that is rebuilt replaces its earlier awards, so a place that fell out of the top 25 on a
 * rerun loses the award; months older than 24 before the newest are dropped.
 */
export function mergeAwards(book: AwardBook, entries: [string, Award][]): AwardBook {
  const rebuilt = new Set(entries.map(([, a]) => `${a.slug}|${a.edition}`))
  const out: AwardBook = {}
  for (const [k, list] of Object.entries(book)) {
    const keep = list.filter((a) => !rebuilt.has(`${a.slug}|${a.edition}`))
    if (keep.length) out[k] = keep
  }
  for (const [k, a] of entries) (out[k] ??= []).push(a)
  let newest = ''
  for (const list of Object.values(out)) for (const a of list) if (a.edition > newest) newest = a.edition
  if (!newest) return out
  const cutoff = monthsBefore(newest, AWARD_MONTHS - 1)
  for (const k of Object.keys(out)) {
    out[k] = out[k].filter((a) => a.edition >= cutoff).sort((a, b) => (a.edition < b.edition ? 1 : a.edition > b.edition ? -1 : a.rank - b.rank))
    if (!out[k].length) delete out[k]
  }
  return out
}

/** Splits entries into the stored buckets they belong to. */
export function bucketEntries(entries: [string, Award][]): Map<number, [string, Award][]> {
  const out = new Map<number, [string, Award][]>()
  for (const e of entries) {
    const b = bucketOf(e[0])
    out.set(b, [...(out.get(b) ?? []), e])
  }
  return out
}

/** The address of a list's edition: the list's own address for its newest month, the dated address for an older one. */
export const editionHref = (slug: string, edition: string, newest: string | undefined) => (edition === newest ? `/rankings/${slug}` : `/rankings/${slug}/${edition}`)

/** Awards ready to show: titled, linked and labelled with the month, newest month first, best rank first within a month. */
export function viewAwards(awards: Award[], index: RankingIndexEntry[]): AwardView[] {
  const by = new Map(index.map((x) => [x.slug, x]))
  const out: AwardView[] = []
  for (const a of awards) {
    const entry = by.get(a.slug)
    if (!entry) continue
    out.push({ ...a, title: entry.title, href: editionHref(a.slug, a.edition, entry.edition), month: editionLabel(a.edition) })
  }
  return out.sort((a, b) => (a.edition < b.edition ? 1 : a.edition > b.edition ? -1 : a.rank - b.rank))
}

export interface AwardMonth { edition: string; month: string; items: AwardView[] }
export function groupByMonth(views: AwardView[]): AwardMonth[] {
  const out: AwardMonth[] = []
  for (const v of views) {
    const last = out[out.length - 1]
    if (last && last.edition === v.edition) last.items.push(v)
    else out.push({ edition: v.edition, month: v.month, items: [v] })
  }
  return out
}

/** A rank's tier, for colour: podium, top ten, or the rest of the top 25. */
export const awardTier = (rank: number): 'podium' | 'top10' | 'top25' => (rank <= 3 ? 'podium' : rank <= 10 ? 'top10' : 'top25')

// ---- Job families ----

const FAMILY_SLUG_PATTERNS = (slug: string) => [
  `best-cities-for-${slug}-jobs`,
  `best-cities-for-${slug}-pay-vs-cost-of-living`,
  `ai-skills-most-requested-in-${slug}-jobs`,
  `ai-tools-named-in-${slug}-jobs`,
]

/** The job family (as postings name it, "Data & Analytics") a list is about, or null. */
export function familyOfRanking(entry: Pick<RankingIndexEntry, 'slug' | 'measure' | 'scopeKind'>): string | null {
  for (const f of FAMILIES) if (FAMILY_SLUG_PATTERNS(f.slug).includes(entry.slug)) return f.fn
  if (entry.measure === 'swe' && entry.scopeKind === 'national') return 'Engineering'
  return null
}

/** The lists about one job family, city lists first. */
export function familyLists(index: RankingIndexEntry[], fn: string): RankingIndexEntry[] {
  const order: Record<string, number> = { swe: 0, fnopen: 0, fnpay: 1, aiskills: 2, aitools: 3, aicerts: 4 }
  return index.filter((x) => familyOfRanking(x) === fn).sort((a, b) => (order[a.measure] ?? 9) - (order[b.measure] ?? 9))
}

/** The family slug used in list addresses ("data-and-analytics"), for a family name. */
export const familySlug = (fn: string) => FAMILIES.find((f) => f.fn === fn)?.slug ?? null

/** The address part of a skill or tool's own page (/ai-skills/<slug>). */
export const skillSlug = (name: string) => name.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// ---- Archive ----

/** Every month that has at least one list, newest first. */
export function archiveMonths(index: RankingIndexEntry[]): string[] {
  return [...new Set(index.flatMap((x) => x.editions))].sort().reverse()
}
