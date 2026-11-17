// Where the jobs are, by city: open roles per city for a function, and for a function inside one
// industry, at each career stage. Built nightly in the same board pass as MarketTargetStat
// (market-size-stats.ts) and read by the "Widen your search" strategy page
// (src/app/dashboard/find-my-job/widen). Pure (no I/O), unit-tested in src/test/city-stats.test.ts.
//
// A city is a metro when the posting's city is one of the listed metro towns AND its state is one
// the metro spans (metro-areas.ts keys on the town name alone, which is fine for members but not for
// postings: Portland ME is not Portland Metro, Aurora IL is not Denver). Otherwise "City, ST".

import { normalizeMetroArea } from '@/lib/constants/metro-areas'
import { stageOfRung } from '@/lib/jobs/career-stage'

/** The states each metro spans. A metro town in any other state is its own city. */
export const METRO_STATES: Record<string, string[]> = {
  'New York Metro': ['NY', 'NJ', 'CT'],
  'SF Bay Area': ['CA'],
  'Los Angeles Metro': ['CA'],
  'Chicago Metro': ['IL'],
  'DC Metro': ['DC', 'VA', 'MD'],
  'Boston Metro': ['MA'],
  'Seattle Metro': ['WA'],
  'Dallas-Fort Worth Metro': ['TX'],
  'Houston Metro': ['TX'],
  'Atlanta Metro': ['GA'],
  'Miami Metro': ['FL'],
  'Philadelphia Metro': ['PA', 'NJ', 'DE'],
  'Phoenix Metro': ['AZ'],
  'Denver Metro': ['CO'],
  'Minneapolis-St. Paul Metro': ['MN'],
  'San Diego Metro': ['CA'],
  'Portland Metro': ['OR'],
  'Detroit Metro': ['MI'],
  'Charlotte Metro': ['NC'],
  'Raleigh-Durham Metro': ['NC'],
  'Nashville Metro': ['TN'],
  'Austin Metro': ['TX'],
  'San Antonio Metro': ['TX'],
  'Tampa Bay Metro': ['FL'],
  'Orlando Metro': ['FL'],
  'St. Louis Metro': ['MO'],
  'Baltimore Metro': ['MD'],
  'Pittsburgh Metro': ['PA'],
  'Cincinnati Metro': ['OH', 'KY'],
  'Columbus Metro': ['OH'],
  'Cleveland Metro': ['OH'],
  'Indianapolis Metro': ['IN'],
  'Kansas City Metro': ['MO', 'KS'],
  'Las Vegas Metro': ['NV'],
  'Sacramento Metro': ['CA'],
  'Salt Lake City Metro': ['UT'],
  'Milwaukee Metro': ['WI'],
  'Providence Metro': ['RI'],
  'Richmond Metro': ['VA'],
  'New Orleans Metro': ['LA'],
  'Jacksonville Metro': ['FL'],
  'Oklahoma City Metro': ['OK'],
  'Memphis Metro': ['TN'],
  'Louisville Metro': ['KY'],
  'Buffalo Metro': ['NY'],
  'Hartford Metro': ['CT'],
  'Birmingham Metro': ['AL'],
  'Albuquerque Metro': ['NM'],
}

const STATE_RE = /^[A-Z]{2}$/

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|[\s\-.'])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())
    .replace(/\bMc([a-z])/g, (_, c: string) => `Mc${c.toUpperCase()}`)
}

/** The posting's city: from locationCity, else the first part of "City, ST" in location. Null for remote or no city. */
export function cityOf(r: { locationCity: string | null; locationState: string | null; location: string | null; workArrangement: string | null }): { city: string; state: string } | null {
  if (r.workArrangement === 'remote') return null
  let city = r.locationCity?.trim() || null
  let state = r.locationState?.trim().toUpperCase() || null
  if (!city && r.location) {
    const m = /^\s*([A-Za-z][A-Za-z .'-]{1,40}),\s*([A-Za-z]{2})\b/.exec(r.location)
    if (m) {
      city = m[1]
      state = state ?? m[2].toUpperCase()
    }
  }
  if (!city || !state || !STATE_RE.test(state)) return null
  if (/remote|virtual|anywhere|multiple|various|united states/i.test(city)) return null
  const metro = normalizeMetroArea(city)
  if (metro && (METRO_STATES[metro] ?? []).includes(state)) return { city: metro, state }
  return { city: `${titleCase(city)}, ${state}`, state }
}

export interface CityStatInput {
  fn: string | null
  level: string | null
  industryBucket: string | null
  city: { city: string; state: string } | null
}

/** kind 'fn': key is the function. kind 'fn_ind': key is `${fn}|${industry bucket}`. */
export type CityStatKind = 'fn' | 'fn_ind'

export interface CityStatRow {
  kind: CityStatKind
  key: string
  band: string
  city: string
  /** The state most of the city's postings are in (a metro can span several). */
  state: string
  openNow: number
}

/** Cities kept per key and band. The page shows six; the rest cover the sum across a member's bands. */
export const CITIES_PER_KEY = 15
/** A city needs this many open roles in a key and band to be kept. */
export const MIN_CITY_OPEN = 2

/** Aggregates live board rows into the top cities per (kind, key, band). */
export function aggregateCityStats(rows: Iterable<CityStatInput>): CityStatRow[] {
  const cells = new Map<string, { kind: CityStatKind; key: string; band: string; city: string; n: number; states: Map<string, number> }>()
  const bump = (kind: CityStatKind, key: string, band: string, c: { city: string; state: string }) => {
    const k = `${kind}\u0000${key}\u0000${band}\u0000${c.city}`
    let cell = cells.get(k)
    if (!cell) cells.set(k, (cell = { kind, key, band, city: c.city, n: 0, states: new Map() }))
    cell.n++
    cell.states.set(c.state, (cell.states.get(c.state) ?? 0) + 1)
  }
  for (const r of rows) {
    if (!r.fn || !r.city) continue
    const band = stageOfRung(r.level) ?? ''
    bump('fn', r.fn, band, r.city)
    if (r.industryBucket) bump('fn_ind', `${r.fn}|${r.industryBucket}`, band, r.city)
  }
  const groups = new Map<string, CityStatRow[]>()
  for (const c of cells.values()) {
    if (c.n < MIN_CITY_OPEN) continue
    const state = [...c.states.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const g = `${c.kind}\u0000${c.key}\u0000${c.band}`
    const list = groups.get(g) ?? []
    list.push({ kind: c.kind, key: c.key, band: c.band, city: c.city, state, openNow: c.n })
    groups.set(g, list)
  }
  const out: CityStatRow[] = []
  for (const list of groups.values()) out.push(...list.sort((a, b) => b.openNow - a.openNow || a.city.localeCompare(b.city)).slice(0, CITIES_PER_KEY))
  return out
}

export interface TopCity {
  city: string
  state: string
  openNow: number
}

/** Sums a key's rows over the member's bands (all bands when none) and ranks the cities. */
export function topCities(rows: readonly Pick<CityStatRow, 'band' | 'city' | 'state' | 'openNow'>[], bands: readonly string[], limit = 6): TopCity[] {
  const by = new Map<string, TopCity>()
  for (const r of rows) {
    if (bands.length > 0 && !bands.includes(r.band)) continue
    const t = by.get(r.city)
    if (t) t.openNow += r.openNow
    else by.set(r.city, { city: r.city, state: r.state, openNow: r.openNow })
  }
  return [...by.values()].sort((a, b) => b.openNow - a.openNow || a.city.localeCompare(b.city)).slice(0, limit)
}
