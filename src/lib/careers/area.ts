import { STATE_NAMES } from '@/lib/workforce/places'
import { METRO_AREA_CODES, STATE_FIPS } from '@/lib/market/metro-areas'

/**
 * Turns a person's city and state into the BLS areas we hold pay for: their metro area when we
 * can tell which one, and always their state. Pure; the catalog of areas we actually loaded is
 * passed in, so an area we have no data for is never returned.
 */
export interface AreaEntry {
  code: string
  name: string
}
export interface AreaCatalog {
  metros: AreaEntry[]
  states: AreaEntry[]
}
export interface AreaRef {
  metro: AreaEntry | null
  state: AreaEntry | null
}

export function stateAbbreviation(state: string | null | undefined): string | null {
  if (!state) return null
  const t = state.trim()
  if (!t) return null
  if (STATE_NAMES[t.toUpperCase()]) return t.toUpperCase()
  const lower = t.toLowerCase()
  return Object.entries(STATE_NAMES).find(([, name]) => name.toLowerCase() === lower)?.[0] ?? null
}

const norm = (s: string) => s.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()

/**
 * BLS names a metro area for its principal cities and states: "Boston-Cambridge-Nashua, MA-NH".
 * Returns the position of `city` among those cities (0 = first listed), or -1 if the area does
 * not contain this city and state.
 */
export function cityPositionInMetro(areaName: string, city: string, stateAbbr: string): number {
  const comma = areaName.lastIndexOf(',')
  if (comma < 0) return -1
  const cities = areaName.slice(0, comma).split(/[-–/]/).map(norm)
  const states = areaName.slice(comma + 1).split(/[-–]/).map((s) => s.trim().toUpperCase())
  if (!states.includes(stateAbbr)) return -1
  return cities.indexOf(norm(city))
}

export function resolveArea(input: { city: string | null | undefined; state: string | null | undefined }, catalog: AreaCatalog): AreaRef {
  const abbr = stateAbbreviation(input.state)
  const fips = abbr ? STATE_FIPS[abbr.toLowerCase()] : undefined
  const state = fips ? catalog.states.find((s) => s.code === fips) ?? null : null

  let metro: AreaEntry | null = null
  const city = input.city?.trim()
  if (city && abbr) {
    // Our own curated list first (it names the big metros exactly), then any metro whose BLS name lists this city.
    const curated = METRO_AREA_CODES[`${city.toLowerCase()}, ${abbr.toLowerCase()}`]
    if (curated) metro = catalog.metros.find((m) => m.code === curated.slice(0, 5)) ?? null
    if (!metro) {
      let bestAt = Number.POSITIVE_INFINITY
      for (const m of catalog.metros) {
        const at = cityPositionInMetro(m.name, city, abbr)
        if (at >= 0 && at < bestAt) {
          bestAt = at
          metro = m
        }
      }
    }
  }
  return { metro, state }
}
