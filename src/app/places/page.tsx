import { pageMetadata } from '@/lib/seo/keywords'
import type { Metadata } from 'next'
import { SeoPage } from '@/components/seo/SeoPage'
import { PlaceLinks } from '@/components/places/PlaceSections'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { getStateIndex, placeUrl } from '@/lib/places/places'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata('/places')

export default async function PlacesIndexPage() {
  // This page is built at deploy time. If the database is busy then (the build runs many pages at once), list every
  // state without its county count instead of failing the deploy; the page refreshes within a day.
  const index = await getStateIndex().catch((error) => {
    console.error('places index: listing states without counts:', error instanceof Error ? error.message : String(error))
    return []
  })
  const have = new Set(index.length ? index.map((s) => s.code) : ALL_STATE_CODES)
  return (
    <SeoPage
      trail={[{ name: 'Local job markets', path: '/places' }]}
      h1="Local job markets"
      lede="For each state, county and city: unemployment, layoff notices, open jobs, the employers hiring most, colleges, the workforce board and American Job Centers."
    >
      <PlaceLinks id="states" title="Choose a state"
        links={ALL_STATE_CODES.filter((c) => have.has(c)).map((c) => ({ href: placeUrl.state(stateSlug(c)), label: stateName(c), note: index.length ? `${index.find((s) => s.code === c)?.counties ?? 0} counties` : undefined }))} />
    </SeoPage>
  )
}
