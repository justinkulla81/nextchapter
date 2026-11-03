// Pure rules for the title-by-place job pages (/jobs/title/<title>/<place>): which (title, place) pairs get a page, how a place is named
// and keyed, and what each page needs from the open listings. No I/O, so they are unit-tested (src/test/job-title-places.test.ts).
// The scan that feeds them is in job-titles.ts; the figures are stored by the board-figures cron, so no page runs a scan itself.

import { STATE_NAMES } from '@/lib/workforce/places'
import { stateSlug, stateFromSlug } from '@/lib/seo/states'

/**
 * Open listings a (title, place) pair needs before it gets a page. A page below the bar has no stored row, so its address
 * redirects to the title page; it gets a page by itself once the listings arrive.
 */
export const PLACE_MIN_JOBS = { city: 10, state: 15 } as const
/** Listings with a stated annual pay a pair needs before its page shows a pay figure. */
export const PLACE_MIN_PAY = 8
/** Distinct employers a pair needs: a page of one or two employers' listings is that employer's job list, not a market. */
export const PLACE_MIN_EMPLOYERS = 3
/** Newest listing ids kept per page (the page shows 15 after re-checking each against the full public-page rule). */
export const PLACE_JOB_IDS = 40
/** Fewer listings than this survive the re-check: the page is thin, so it redirects to the title page. */
export const PLACE_MIN_SHOWN = 5

export type PlaceKind = 'city' | 'state'

/** Listings sometimes name a city two ways; both go to one page. */
const CITY_ALIASES: Record<string, string> = {
  'new york city': 'new york',
  nyc: 'new york',
  'washington dc': 'washington',
  'washington d.c.': 'washington',
  'washington, dc': 'washington',
}

const normCity = (city: string) => {
  const c = city.toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ').trim()
  return CITY_ALIASES[c] ?? c
}

/** A listing's city when it reads as a city name (letters, spaces, a dot, apostrophe or hyphen; up to four words), else null. */
export function cleanCity(city: string | null | undefined): string | null {
  if (!city) return null
  const c = normCity(city)
  if (!/^[a-z][a-z .'-]{1,38}$/.test(c)) return null
  if (c.split(' ').length > 4) return null
  if (/(remote|virtual|anywhere|multiple|various|hybrid|united states|nationwide|\busa\b|\blocations?\b|\bbased\b)/.test(c)) return null
  return c
}

const SMALL = new Set(['of', 'the', 'and'])
/** "san francisco" -> "San Francisco", "o'fallon" -> "O'Fallon", "winston-salem" -> "Winston-Salem". */
export function displayCity(city: string): string {
  return city
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/(^|['-])([a-z])/g, (_m, p: string, ch: string) => p + ch.toUpperCase())))
    .join(' ')
}

const slugify = (s: string) => s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** "chicago-il" for a city, "texas" for a state. Null when the city or state code is not usable. */
export function placeKey(kind: PlaceKind, state: string, city?: string | null): string | null {
  if (!(state in STATE_NAMES)) return null
  if (kind === 'state') return stateSlug(state)
  const c = cleanCity(city)
  if (!c) return null
  const s = slugify(c)
  return s ? `${s}-${state.toLowerCase()}` : null
}

export interface ParsedPlace { kind: PlaceKind; state: string; citySlug: string | null }

/** The place part of an address: a state slug ("texas") or a city slug with its state code ("chicago-il"). */
export function parsePlace(place: string): ParsedPlace | null {
  if (!/^[a-z0-9-]{2,60}$/.test(place)) return null
  const state = stateFromSlug(place)
  if (state) return { kind: 'state', state, citySlug: null }
  const m = /^([a-z0-9-]+)-([a-z]{2})$/.exec(place)
  if (!m) return null
  const code = m[2].toUpperCase()
  return code in STATE_NAMES ? { kind: 'city', state: code, citySlug: m[1] } : null
}

/** "Chicago, IL" or "Texas". */
export function placeName(kind: PlaceKind, state: string, city?: string | null): string {
  if (kind === 'state') return STATE_NAMES[state] ?? state
  return `${displayCity(cleanCity(city) ?? '')}, ${state}`
}

export interface PlaceRow { id: string; state: string | null; city: string | null; company: string; posted: number; pay: number | null }
export interface PlaceTitle { slug: string; name: string; rows: PlaceRow[] }

export interface TitlePlace {
  titleSlug: string
  kind: PlaceKind
  key: string
  name: string
  state: string
  jobs: number
  payCount: number
  /** Median of the stated annual pay, rounded to $500, when enough listings state pay. */
  median: number | null
  /** The newest listing ids, newest first. */
  jobIds: string[]
  employers: { name: string; jobs: number }[]
  /** Other titles with a page in this same place. */
  otherTitles: { slug: string; name: string; jobs: number }[]
  /** Other places with a page for this same title: cities in this state, or for a state page its largest cities. */
  nearby: { key: string; name: string; jobs: number }[]
}

const round500 = (n: number) => Math.round(n / 500) * 500

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const pos = (s.length - 1) / 2
  return (s[Math.floor(pos)] + s[Math.ceil(pos)]) / 2
}

/** Every (title, place) pair that meets the bar, with the figures its page needs. */
export function computeTitlePlaces(titles: PlaceTitle[], bars: { city: number; state: number; employers: number } = { ...PLACE_MIN_JOBS, employers: PLACE_MIN_EMPLOYERS }): TitlePlace[] {
  const out: TitlePlace[] = []
  for (const t of titles) {
    const groups = new Map<string, { kind: PlaceKind; state: string; city: string | null; rows: PlaceRow[] }>()
    const add = (key: string | null, kind: PlaceKind, state: string, city: string | null, r: PlaceRow) => {
      if (!key) return
      const g = groups.get(key) ?? { kind, state, city, rows: [] }
      g.rows.push(r)
      groups.set(key, g)
    }
    for (const r of t.rows) {
      if (!r.state || !(r.state in STATE_NAMES)) continue
      add(placeKey('state', r.state), 'state', r.state, null, r)
      const c = cleanCity(r.city)
      if (c) add(placeKey('city', r.state, c), 'city', r.state, c, r)
    }
    for (const [key, g] of groups) {
      if (g.rows.length < bars[g.kind]) continue
      const pay = g.rows.flatMap((r) => (r.pay == null ? [] : [r.pay]))
      const byEmployer = new Map<string, number>()
      for (const r of g.rows) byEmployer.set(r.company, (byEmployer.get(r.company) ?? 0) + 1)
      if (byEmployer.size < bars.employers) continue
      out.push({
        titleSlug: t.slug,
        kind: g.kind,
        key,
        name: placeName(g.kind, g.state, g.city),
        state: g.state,
        jobs: g.rows.length,
        payCount: pay.length,
        median: pay.length >= PLACE_MIN_PAY ? round500(median(pay)!) : null,
        jobIds: [...g.rows].sort((a, b) => b.posted - a.posted).slice(0, PLACE_JOB_IDS).map((r) => r.id),
        employers: [...byEmployer].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([name, jobs]) => ({ name, jobs })),
        otherTitles: [],
        nearby: [],
      })
    }
  }
  const names = new Map(titles.map((t) => [t.slug, t.name]))
  const byPlace = new Map<string, TitlePlace[]>()
  const byTitleState = new Map<string, TitlePlace[]>()
  for (const p of out) {
    ;(byPlace.get(p.key) ?? byPlace.set(p.key, []).get(p.key)!).push(p)
    ;(byTitleState.get(`${p.titleSlug}:${p.state}`) ?? byTitleState.set(`${p.titleSlug}:${p.state}`, []).get(`${p.titleSlug}:${p.state}`)!).push(p)
  }
  for (const p of out) {
    p.otherTitles = (byPlace.get(p.key) ?? [])
      .filter((o) => o.titleSlug !== p.titleSlug)
      .sort((a, b) => b.jobs - a.jobs || a.titleSlug.localeCompare(b.titleSlug))
      .slice(0, 8)
      .map((o) => ({ slug: o.titleSlug, name: names.get(o.titleSlug) ?? o.titleSlug, jobs: o.jobs }))
    p.nearby = (byTitleState.get(`${p.titleSlug}:${p.state}`) ?? [])
      .filter((o) => o.kind === 'city' && o.key !== p.key)
      .sort((a, b) => b.jobs - a.jobs || a.key.localeCompare(b.key))
      .slice(0, 8)
      .map((o) => ({ key: o.key, name: o.name, jobs: o.jobs }))
  }
  return out.sort((a, b) => b.jobs - a.jobs || a.titleSlug.localeCompare(b.titleSlug) || a.key.localeCompare(b.key))
}

/** The sitemap and the title page's city links read this short list instead of every page's row. */
export type PlaceIndexRow = [titleSlug: string, key: string, kind: PlaceKind, jobs: number, name: string]

export const placeIndex = (places: TitlePlace[]): PlaceIndexRow[] => places.map((p) => [p.titleSlug, p.key, p.kind, p.jobs, p.name])
