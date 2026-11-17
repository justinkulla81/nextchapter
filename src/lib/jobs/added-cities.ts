// Cities a member added to their search (SearchExpansion.cities, from Widen your search). A city adds only the jobs
// in or near it, never its whole state. Two tests, one for each reader:
//  - The board's relevance rings (relevance.ts geoRing) have the job's coordinates: a job within COMMUTE_MILES of an
//    added city's centre counts like home. That is the same distance home uses.
//  - The fit score (job-fit-bucket.ts placeFit) has only the location text: a job counts as local when its location
//    names one of the city's towns (a metro's listed towns) in one of the city's states.
// Pure and client-safe. Tests: src/test/added-cities.test.ts.

import { metroTowns } from '@/lib/constants/metro-areas'
import { METRO_STATES } from '@/lib/market/city-stats'
import type { AddedCity } from '@/lib/profile/search-expansion'

/** The towns and states an added city covers: a metro's listed towns and states, or the one city in its state. */
export function cityCoverage(c: Pick<AddedCity, 'name' | 'state'>): { towns: string[]; states: string[] } {
  const towns = metroTowns(c.name)
  if (towns.length > 0) return { towns, states: METRO_STATES[c.name] ?? [c.state] }
  return { towns: [cityTown(c.name)], states: [c.state] }
}

/** "Austin, TX" → "austin". */
export function cityTown(name: string): string {
  return name.replace(/,\s*[A-Za-z]{2}$/, '').trim().toLowerCase()
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export interface CityMatcher {
  name: string
  re: RegExp
  states: string[]
}

/** One whole-word matcher per added city, built once per member. */
export function cityMatchers(cities: readonly Pick<AddedCity, 'name' | 'state'>[]): CityMatcher[] {
  return cities.map((c) => {
    const { towns, states } = cityCoverage(c)
    // "St. Louis" and "Saint Louis" both name it; whole words only, so "Columbia" is not inside "British Columbia".
    const alts = towns.map((t) => esc(t).replace(/\\\.\s*/g, '\\.?\\s*').replace(/\s+/g, '\\s+'))
    return { name: c.name, re: new RegExp(`(^|[^a-z])(${alts.join('|')})([^a-z]|$)`, 'i'), states }
  })
}

/** The added city a job's location text is in, or null. `jobStates` are the states the location names. */
export function addedCityFor(location: string, jobStates: readonly string[], matchers: readonly CityMatcher[]): string | null {
  if (!location || matchers.length === 0) return null
  for (const m of matchers) {
    if (!m.re.test(location)) continue
    // A location with no state ("Austin") is taken at its word; one with states must be in the city's.
    if (jobStates.length === 0 || jobStates.some((s) => m.states.includes(s))) return m.name
  }
  return null
}

function miles(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = 3958.8
  const rad = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

/** The added city a job's coordinates are within `radius` miles of, or null. */
export function addedCityNear(coords: readonly { lat: number; lon: number }[], cities: readonly AddedCity[], radius: number): AddedCity | null {
  if (coords.length === 0 || cities.length === 0) return null
  for (const c of cities) if (coords.some((p) => miles(c, p) <= radius)) return c
  return null
}

/** How an added city reads in a sentence: "Austin" for "Austin, TX", the metro name without "Metro". */
export function cityLabel(name: string): string {
  return name.replace(/,\s*[A-Za-z]{2}$/, '').replace(/\s+Metro$/, '').trim()
}
