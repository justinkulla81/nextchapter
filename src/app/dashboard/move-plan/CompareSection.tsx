import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { stateCode } from '@/lib/workforce/area-brief'
import { STATE_NAMES } from '@/lib/workforce/places'
import { comparePlaces, currentMetro, loadMetros } from '@/lib/workforce/metro-compare-data'
import { isEmployedStatus, parsePlaces, type Lens } from '@/lib/workforce/metro-compare'
import { ComparePlaces } from '@/components/market/ComparePlaces'

// The job-market side of Your move plan: where you live now against up to three other metro areas, measured the same way.
// The places are in the address (?m=), so a comparison can be saved and shared. ?lens=life drops the job rows.
export async function CompareSection({ m, lens: rawLens }: { m?: string; lens?: string }) {
  const [profile, metros] = await Promise.all([getDashboardProfile(), loadMetros()])
  const lens: Lens = rawLens === 'life' ? 'life' : 'job'
  const chosenCodes = parsePlaces(m, metros)
  const home = await currentMetro(profile.currentCity, stateCode(profile.currentState, STATE_NAMES))
  const result = await comparePlaces({
    current: home,
    chosen: chosenCodes.map((c) => metros.find((x) => x.cbsa === c)!),
    member: { primaryFunction: profile.primaryFunction, industryBucket: profile.industryBucket },
  }).catch(() => null)

  if (!result) {
    return <p className="max-w-xl text-base text-muted-foreground">We could not load the comparison just now. Reload the page in a few minutes and it will be here.</p>
  }
  return (
    <ComparePlaces
      employed={isEmployedStatus(profile.currentJobStatus)}
      lens={lens}
      current={result.current}
      places={result.places}
      chosen={chosenCodes}
      metros={metros.filter((x) => x.cbsa !== home?.cbsa).map((x) => ({ cbsa: x.cbsa, name: x.name }))}
      fieldName={result.fieldName}
    />
  )
}
