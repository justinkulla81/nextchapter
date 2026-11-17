import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { loadReflections } from '@/lib/strengths-interview/load'
import { areaOf, type AreaKey } from '@/lib/strengths-interview/areas'
import { StrengthInterview } from '@/components/dashboard/why-hire/StrengthInterview'
import { finishStrengthArea, saveStrengthAnswer, skipStrengthFollowUp } from './actions'

export const metadata: Metadata = { title: 'Find your strengths' }

// Find your strengths: the hub of six areas, or one area's questions (?area=), or an area answered again (&redo=1).
export default async function DiscoverStrengthsPage({ searchParams }: { searchParams: Promise<{ area?: string; redo?: string }> }) {
  const { area: raw, redo } = await searchParams
  const area = raw && areaOf(raw) ? (raw as AreaKey) : null
  const profile = await getDashboardProfile()
  const rows = await loadReflections(profile.id)
  return (
    <div className="max-w-2xl">
      <StrengthInterview area={area} rows={rows} redo={redo === '1'} actions={{ save: saveStrengthAnswer, skipFollowUp: skipStrengthFollowUp, finish: finishStrengthArea }} />
    </div>
  )
}
