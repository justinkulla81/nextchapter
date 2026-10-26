import { pageMetadata } from '@/lib/seo/keywords'
import type { Metadata } from 'next'
import { SeoPage } from '@/components/seo/SeoPage'
import { PlaceLinks } from '@/components/places/PlaceSections'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { getStateIndex, placeUrl } from '@/lib/places/places'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata('/places')

export default async function PlacesIndexPage() {
  const index = await getStateIndex()
  const have = new Set(index.map((s) => s.code))
  return (
    <SeoPage
      trail={[{ name: 'Local job markets', path: '/places' }]}
      h1="Local job markets"
      lede="For each state, county and city: unemployment, layoff notices, open jobs, the employers hiring most, colleges, the workforce board and American Job Centers."
    >
      <PlaceLinks id="states" title="Choose a state"
        links={ALL_STATE_CODES.filter((c) => have.has(c)).map((c) => ({ href: placeUrl.state(stateSlug(c)), label: stateName(c), note: `${index.find((s) => s.code === c)?.counties ?? 0} counties` }))} />
    </SeoPage>
  )
}
