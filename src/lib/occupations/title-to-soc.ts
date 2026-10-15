import type { OccupationProfile } from './types'

// Maps a free-text job title (a posting's, or one from a member's work history) to an
// O*NET occupation through O*NET's alternate titles. Deterministic, no AI. A title we
// can't place confidently returns null, which callers show as "unmapped", never a guess.

export interface TitleIndexEntry {
  onetSocCode: string
  socCode: string
  title: string
}

export type TitleMatchConfidence = 'exact' | 'fuzzy'

export interface TitleMatch {
  onetSocCode: string
  socCode: string
  matchedTitle: string
  confidence: TitleMatchConfidence
}

// Words that say level, not occupation. Level is scored elsewhere.
const LEVEL_WORDS = new Set(['senior', 'sr', 'jr', 'junior', 'lead', 'principal', 'staff', 'interim', 'associate', 'global', 'regional', 'group'])
const STOP_WORDS = new Set(['of', 'the', 'and', 'for', 'a', 'an', 'in', 'to'])

// O*NET titles are plural ("Marketing Managers"), job titles singular. "business",
// "sales" and "analysis" keep their form; applied to both sides so they still agree.
function singular(word: string): string {
  if (word.length <= 3 || /(ss|us|is)$/.test(word) || word === 'sales') return word
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
  return word.endsWith('s') ? word.slice(0, -1) : word
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // "(emea)"
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(singular)
    .join(' ')
}

function tokens(normalized: string): string[] {
  return normalized.split(' ').filter((t) => t && !STOP_WORDS.has(t))
}

/** A normalized title without its level words ("senior marketing manager" -> "marketing manager"). */
function stripLevel(normalized: string): string {
  return normalized.split(' ').filter((t) => !LEVEL_WORDS.has(t)).join(' ').trim()
}

// "VP of Marketing", "Head of Sales", "Director, Finance" are written as a rank plus a
// function; O*NET files the function under manager or director titles.
const RANK_PREFIX = /^(?:(?:executive|managing|senior|group|regional|global)\s+)*(?:vp|svp|evp|avp|vice president|head|director|manager)\s+(?:of\s+)?(.+)$/

/** The normalized forms of a title to try, most specific first. */
export function titleVariants(title: string): string[] {
  const norm = normalizeTitle(title)
  if (!norm) return []
  const out: string[] = [norm]
  const stripped = stripLevel(norm)
  if (stripped && stripped !== norm) out.push(stripped)
  const m = RANK_PREFIX.exec(stripped || norm)
  if (m && m[1]) {
    const fn = stripLevel(m[1])
    if (fn) out.push(`${fn} manager`, `${fn} director`, fn)
  }
  return [...new Set(out)]
}

export interface TitleIndex {
  /** normalized title -> the distinct occupations that list it. */
  byTitle: Map<string, Map<string, TitleIndexEntry>>
  entries: { normalized: string; tokens: string[]; entry: TitleIndexEntry }[]
}

/** Builds the lookup from alternate titles plus each occupation's own title. */
export function buildTitleIndex(
  occupations: Pick<OccupationProfile, 'onetSocCode' | 'socCode' | 'title'>[],
  altTitles: { onetSocCode: string; title: string }[]
): TitleIndex {
  const bySoc = new Map(occupations.map((o) => [o.onetSocCode, o]))
  const byTitle: TitleIndex['byTitle'] = new Map()
  const entries: TitleIndex['entries'] = []
  const add = (onetSocCode: string, title: string) => {
    const occ = bySoc.get(onetSocCode)
    const normalized = normalizeTitle(title)
    if (!occ || !normalized) return
    const entry: TitleIndexEntry = { onetSocCode, socCode: occ.socCode, title }
    const bucket = byTitle.get(normalized) ?? new Map<string, TitleIndexEntry>()
    if (bucket.has(onetSocCode)) return
    bucket.set(onetSocCode, entry)
    byTitle.set(normalized, bucket)
    entries.push({ normalized, tokens: tokens(normalized), entry })
  }
  for (const o of occupations) add(o.onetSocCode, o.title)
  for (const a of altTitles) add(a.onetSocCode, a.title)
  return { byTitle, entries }
}

/** A fuzzy match needs at least this share of tokens in common, and at least two shared tokens. */
export const MIN_FUZZY_SIMILARITY = 0.75
/** The best fuzzy match must beat the next occupation's by this much, or the title is ambiguous. */
export const MIN_FUZZY_MARGIN = 0.1

function jaccard(a: string[], b: string[]): { score: number; shared: number } {
  const sa = new Set(a)
  const sb = new Set(b)
  let shared = 0
  for (const t of sa) if (sb.has(t)) shared++
  const union = sa.size + sb.size - shared
  return { score: union === 0 ? 0 : shared / union, shared }
}

/**
 * The occupation a title belongs to, or null. A title two occupations both list exactly
 * is ambiguous and returns null rather than picking one.
 */
export function titleToOccupation(title: string, index: TitleIndex): TitleMatch | null {
  const variants = titleVariants(title)
  for (const v of variants) {
    const bucket = index.byTitle.get(v)
    if (!bucket) continue
    if (bucket.size > 1) return null
    const [only] = bucket.values()
    return { onetSocCode: only.onetSocCode, socCode: only.socCode, matchedTitle: only.title, confidence: 'exact' }
  }

  const queryTokens = tokens(variants[variants.length > 1 ? 1 : 0] ?? '')
  if (queryTokens.length < 2) return null
  const best = new Map<string, { score: number; entry: TitleIndexEntry }>()
  for (const e of index.entries) {
    const { score, shared } = jaccard(queryTokens, e.tokens)
    if (shared < 2 || score < MIN_FUZZY_SIMILARITY) continue
    const prev = best.get(e.entry.onetSocCode)
    if (!prev || score > prev.score) best.set(e.entry.onetSocCode, { score, entry: e.entry })
  }
  const ranked = [...best.values()].sort((a, b) => b.score - a.score)
  if (ranked.length === 0) return null
  if (ranked.length > 1 && ranked[0].score - ranked[1].score < MIN_FUZZY_MARGIN) return null
  const top = ranked[0].entry
  return { onetSocCode: top.onetSocCode, socCode: top.socCode, matchedTitle: top.title, confidence: 'fuzzy' }
}
