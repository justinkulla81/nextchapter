import type { Metadata } from 'next'
import { after } from 'next/server'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getParallelPaths } from '@/lib/job-reviews/data'
import { captureServerEvent } from '@/lib/posthog/server'
import { effectiveJourney } from '@/lib/journey/journey'
import { workingNowOf } from '@/lib/journey/intensity'
import { activePaths, incomeNeedOf } from '@/lib/journey/paths'
import { hasBuyDetails } from '@/lib/journey/buy-business'
import { PageHeader } from '@/components/candidate/PageHeader'
import { OtherPathsView } from '@/components/dashboard/paths/OtherPathsView'

export const metadata: Metadata = { title: 'Your other paths' }

export default async function OtherPathsPage() {
  const profile = await getDashboardProfile()
  const kinds = await getParallelPaths(profile.id)
  const main = effectiveJourney(profile)
  const cards = activePaths({ main, journeyDetails: profile.journeyDetails, kinds })
  const buyStarted = hasBuyDetails(profile.journeyDetails)
  after(() =>
    captureServerEvent(profile.id, 'other_paths_viewed', { main, paths: cards.map((c) => c.key), incomeNeed: incomeNeedOf(profile.journeyDetails), kinds: kinds ?? [], buyStarted }),
  )
  return (
    <div className="space-y-8">
      <PageHeader
        title="Your other paths"
        intro="Side work, buying a business, fractional work on the side. Your main focus keeps your weekly plan, and each path here adds one step."
      />
      <OtherPathsView main={main} journeyDetails={profile.journeyDetails} kinds={kinds} cards={cards} workingNow={workingNowOf(profile.journeyDetails)} buyStarted={buyStarted} />
    </div>
  )
}
