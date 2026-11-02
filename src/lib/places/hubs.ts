import 'server-only'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'
import { placeKey } from '@/lib/workforce/places'
import { getStateCities, getStateCityPlaces, getStateCounties, placeUrl } from '@/lib/places/places'

// Where a company hires, as links to our city pages. Job locations are free text ("Remote - US", "United States"); only
// a clean "City, ST" is a hub, and it links only when that city has a page.

export interface Hub { label: string; count: number; href: string | null; countyFips: string | null }

const CITY_ST = /^([A-Za-z][A-Za-z .'\-]+?),\s*([A-Z]{2})$/

export async function hubsFor(locations: { location: string; count: number }[], limit = 6): Promise<Hub[]> {
  const rows: { city: string; st: string; count: number }[] = []
  for (const l of locations) {
    const m = CITY_ST.exec(l.location.trim())
    if (m && ALL_STATE_CODES.includes(m[2])) rows.push({ city: m[1].trim(), st: m[2], count: l.count })
  }
  const top = rows.slice(0, limit)
  return Promise.all(top.map(async (r) => {
    const label = `${r.city}, ${r.st}`
    try {
      const [places, live, counties] = await Promise.all([getStateCityPlaces(r.st), getStateCities(r.st), getStateCounties(r.st)])
      const place = places.find((p) => p.key === placeKey(r.city))
      const ok = place && live.some((c) => c.slug === place.slug)
      const county = place?.county ? counties.find((c) => c.name === place.county) : null
      return { label, count: r.count, href: ok ? placeUrl.city(stateSlug(r.st), place.slug) : null, countyFips: county?.fips ?? null }
    } catch {
      return { label, count: r.count, href: null, countyFips: null }
    }
  }))
}
