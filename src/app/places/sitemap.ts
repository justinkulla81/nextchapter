import type { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'
import { SITE_URL } from '@/lib/seo/facts'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'
import { getAllCityEntries, getAllCounties, getCountiesWithRecentNotices, meetsCountyBar, placeUrl } from '@/lib/places/places'
import { countyKey } from '@/lib/workforce/places'

// The place pages: /places, every state, every county, and the cities that pass the bar (places.ts). Listed in the
// sitemap index (src/app/sitemap-index.xml/route.ts) and served at /places/sitemap.xml.
//
// Building it takes a minute of database work (every county, and every state's cities and open jobs), so it is not
// built during a deploy: the route is dynamic, and the result is kept in the data cache for six hours. A deploy that
// fails or slows down over this sitemap was the cost of building it at deploy time (2026-10-26).
export const dynamic = 'force-dynamic'

const states = (): MetadataRoute.Sitemap => [
  { url: `${SITE_URL}/places`, changeFrequency: 'weekly', priority: 0.6 },
  ...ALL_STATE_CODES.map((code) => ({ url: `${SITE_URL}${placeUrl.state(stateSlug(code))}`, changeFrequency: 'daily' as const, priority: 0.7 })),
]

// Not caught inside: a failed run throws, so a half-built list is never cached.
const build = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const out = states()
    const counties = await getAllCounties()
    const cities = await getAllCityEntries()
    const withNotices = await getCountiesWithRecentNotices()
    const citiesIn = new Map<string, number>()
    for (const c of cities) if (c.county) citiesIn.set(`${c.state}|${c.county}`, (citiesIn.get(`${c.state}|${c.county}`) ?? 0) + 1)
    for (const code of ALL_STATE_CODES) {
      for (const c of counties.get(code) ?? []) {
        // Big enough or with a city of its own, or named by a layoff notice in the last 12 months (countyIndexable in places.ts).
        if (!meetsCountyBar(c.population, citiesIn.get(`${code}|${c.name}`) ?? 0) && !withNotices.has(`${code}|${countyKey(c.name)}`)) continue
        out.push({ url: `${SITE_URL}${placeUrl.county(stateSlug(code), c.slug)}`, changeFrequency: 'weekly', priority: 0.5 })
      }
    }
    for (const c of cities) out.push({ url: `${SITE_URL}${placeUrl.city(stateSlug(c.state), c.slug)}`, changeFrequency: 'daily', priority: 0.4 })
    return out
  },
  ['places-sitemap-v3'],
  { revalidate: 21600 },
)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    return await build()
  } catch (error) {
    // The database is unreachable or slow: serve the state pages, and try again on the next request.
    console.error('places sitemap: falling back to the state list:', error instanceof Error ? error.message : String(error))
    return states()
  }
}
