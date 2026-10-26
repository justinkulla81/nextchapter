import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'
import { getAllCityEntries, getStateCounties, placeUrl } from '@/lib/places/places'

// The place pages: /places, every state, every county, and the cities that pass the bar (places.ts). Listed in the
// sitemap index (src/app/sitemap-index.xml/route.ts) and served at /places/sitemap.xml.
export const revalidate = 21600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = [{ url: `${SITE_URL}/places`, changeFrequency: 'weekly', priority: 0.6 }]
  const counties = await Promise.all(ALL_STATE_CODES.map((c) => getStateCounties(c).catch(() => [])))
  ALL_STATE_CODES.forEach((code, i) => {
    out.push({ url: `${SITE_URL}${placeUrl.state(stateSlug(code))}`, changeFrequency: 'daily', priority: 0.7 })
    for (const c of counties[i]) out.push({ url: `${SITE_URL}${placeUrl.county(stateSlug(code), c.slug)}`, changeFrequency: 'weekly', priority: 0.5 })
  })
  const cities = await getAllCityEntries().catch(() => [])
  for (const c of cities) out.push({ url: `${SITE_URL}${placeUrl.city(stateSlug(c.state), c.slug)}`, changeFrequency: 'daily', priority: 0.4 })
  return out
}
