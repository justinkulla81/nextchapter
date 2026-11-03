import { placeKey } from '@/lib/workforce/places'

/** The keys a ranking stores a city under ("TX|austin"): the posting's own spelling, then the normalised one ("st louis"). */
export function cityAwardKeys(city: string, st: string): string[] {
  return [...new Set([`${st}|${city.toLowerCase().trim()}`, `${st}|${placeKey(city)}`])]
}

const CITY_ST = /^([A-Za-z][A-Za-z .'\-]+?),\s*([A-Z]{2})$/

/** A "City, ST" location as a place for the awards block, or null when it is not one. */
export function placeFromLocation(location: string): { name: string; keys: string[] } | null {
  const m = CITY_ST.exec(location.trim())
  return m ? { name: `${m[1].trim()}, ${m[2]}`, keys: cityAwardKeys(m[1].trim(), m[2]) } : null
}
