import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/facts'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'
import { EVENTS_STATE_MIN, eventStateCounts } from '@/lib/local-events/queries'

// /events and the state pages that list enough upcoming events to be offered to search engines. Served at /events/sitemap.xml and listed in the sitemap index.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const counts = await eventStateCounts()
  return [
    { url: `${SITE_URL}/events`, changeFrequency: 'weekly', priority: 0.6 },
    ...ALL_STATE_CODES.filter((c) => (counts[c] ?? 0) >= EVENTS_STATE_MIN).map((c) => ({ url: `${SITE_URL}/events/${stateSlug(c)}`, changeFrequency: 'weekly' as const, priority: 0.5 })),
  ]
}
