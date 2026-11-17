import type { PlaceRank, RankingIndexEntry } from '@/lib/rankings/types'
import { SITE_URL } from '@/lib/seo/facts'

// The one ranking a workforce board's email can lead with: a placing for a place inside its own area that is worth telling them
// about. Pure, so the rules are tested without a database.

/** A place in a board's area and the keys its placings are stored under (a county FIPS, or "ST|placekey" for a city). */
export interface AreaPlace { key: string; name: string; level: 'county' | 'city' }

export interface RankingPick { place: string; level: 'county' | 'city'; rank: number; places: number; title: string; slug: string; edition: string; scope: RankingIndexEntry['scopeKind'] }

/** Lists that say nothing a board would take as good news about its area, or are about something other than its job market. */
const SKIP = /conference|AI-exposed|white-collar workers|\w pay after cost of living/i
/** A list this short is not much of a placing. */
const MIN_PLACES = 20

/** Census place names carry their kind ("Durham city", "Exton CDP", "Indianapolis city (balance)"); an email says the name. */
export function plainPlaceName(name: string): string {
  return name.replace(/\s+\(balance\)$/i, '').replace(/\s+(city|town|township|village|borough|CDP|municipality)$/i, '').trim()
}

/**
 * The best placing among the board's places: national lists in the top 10 first, then a regional or state list's top 3; the better
 * rank wins, a county over a city on a tie (a board's area is counties). Null when nothing qualifies.
 */
export function pickRanking(area: AreaPlace[], ranks: Record<string, PlaceRank[]>, index: RankingIndexEntry[]): RankingPick | null {
  const bySlug = new Map(index.map((x) => [x.slug, x]))
  let best: (RankingPick & { national: boolean }) | null = null
  for (const p of area) {
    for (const r of ranks[p.key] ?? []) {
      const entry = bySlug.get(r.slug)
      if (!entry || SKIP.test(r.title) || r.places < MIN_PLACES) continue
      const national = entry.scopeKind === 'national'
      if (r.rank > (national ? 10 : 3)) continue
      const cand = { place: p.level === 'city' ? plainPlaceName(p.name) : p.name, level: p.level, rank: r.rank, places: r.places, title: r.title, slug: r.slug, edition: entry.edition, scope: entry.scopeKind, national }
      if (!best || better(cand, best)) best = cand
    }
  }
  if (!best) return null
  const { national: _n, ...pick } = best
  return pick
}

function better(a: RankingPick & { national: boolean }, b: RankingPick & { national: boolean }): boolean {
  if (a.national !== b.national) return a.national
  if (a.rank !== b.rank) return a.rank < b.rank
  return a.level === 'county' && b.level === 'city'
}

/** "2026-11" → "November 2026". */
const editionLabel = (edition: string) => { const [y, m] = edition.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)

/** "Johnston County is #2 of 100 on NextChapter's November 2026 list of the fastest-growing job markets." with the list linked. */
export function rankingSentenceHtml(p: RankingPick | null, esc: (s: string) => string): string {
  if (!p) return ''
  const url = `${SITE_URL}/rankings/${p.slug}`
  return `${esc(p.place)} is #${p.rank} of ${p.places} on NextChapter&#39;s ${esc(editionLabel(p.edition))} list of the <a href="${esc(url)}">${esc(lowerFirst(p.title))}</a>.`
}
