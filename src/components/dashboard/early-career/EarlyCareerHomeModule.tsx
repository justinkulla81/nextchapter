import Link from 'next/link'
import { HomeModule } from '@/components/dashboard/home/HomeModule'
import { EarlyCareerChecklist } from './EarlyCareerChecklist'
import type { EarlyCareerAudience } from '@/lib/early-career/audience'
import { loadEarlyCareerView } from '@/lib/early-career/data'

type Props = {
  audience: EarlyCareerAudience
  profile: Parameters<typeof loadEarlyCareerView>[0]
}

// Home's early-career module: the next three open checklist steps. Loads in
// its own Suspense boundary; on any error it stays out of the way.
export async function EarlyCareerHomeModule({ audience, profile }: Props) {
  const view = await loadEarlyCareerView(profile, audience).catch((error) => {
    console.error('Failed to load early-career checklist:', error)
    return null
  })
  if (!view) return null
  const done = view.checklist.filter((r) => r.done).length
  return (
    <HomeModule
      title={audience === 'NEW_GRAD' ? `Your first job plan: ${done} of ${view.checklist.length} done` : `Your next step plan: ${done} of ${view.checklist.length} done`}
      action={
        <Link href="/dashboard/early-career" className="text-sm font-medium text-brand underline underline-offset-4">
          Open the plan
        </Link>
      }
    >
      <EarlyCareerChecklist rows={view.checklist} compact />
    </HomeModule>
  )
}
