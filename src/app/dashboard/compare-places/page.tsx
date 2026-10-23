import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { stateCode } from '@/lib/workforce/area-brief'
import { STATE_NAMES } from '@/lib/workforce/places'
import { comparePlaces, currentMetro, loadMetros } from '@/lib/workforce/metro-compare-data'
import { isEmployedStatus, parsePlaces, type Lens } from '@/lib/workforce/metro-compare'
import { ComparePlaces } from '@/components/market/ComparePlaces'
import { PageHeader } from '@/components/candidate/PageHeader'

export const metadata: Metadata = { title: 'Compare places' }

// Where you live now against up to three other metro areas, measured the same way: unemployment, open roles,
// growth in your sector, cost of living and help with moving. The places are in the address (?m=), so a
// comparison can be saved and shared. A move can be for a job search or for life; ?lens=life drops the job rows.
export default async function ComparePlacesPage({ searchParams }: { searchParams: Promise<{ m?: string; lens?: string }> }) {
  const [profile, params, metros] = await Promise.all([getDashboardProfile(), searchParams, loadMetros()])
  const lens: Lens = params.lens === 'life' ? 'life' : 'job'
  const chosenCodes = parsePlaces(params.m, metros)
  const home = await currentMetro(profile.currentCity, stateCode(profile.currentState, STATE_NAMES))
  const member = { primaryFunction: profile.primaryFunction, industryBucket: profile.industryBucket }

  const result = await comparePlaces({
    current: home,
    chosen: chosenCodes.map((c) => metros.find((m) => m.cbsa === c)!),
    member,
  }).catch(() => null)

  if (!result) {
    return (
      <div className="space-y-8">
        <PageHeader title="Compare places" />
        <p className="max-w-xl text-base text-muted-foreground">We could not load the comparison just now. Reload the page in a few minutes and it will be here.</p>
      </div>
    )
  }

  return (
    <ComparePlaces
      employed={isEmployedStatus(profile.currentJobStatus)}
      lens={lens}
      current={result.current}
      places={result.places}
      chosen={chosenCodes}
      metros={metros.filter((m) => m.cbsa !== home?.cbsa).map((m) => ({ cbsa: m.cbsa, name: m.name }))}
      fieldName={result.fieldName}
    />
  )
}
