import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { OtherPathsView } from '@/components/dashboard/paths/OtherPathsView'
import { activePaths } from '@/lib/journey/paths'

// "Your other paths" as built (src/app/dashboard/other-paths/page.tsx), fed sample data.

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PreviewShell place="learn" entry="learn" part="skills">
      <div className="space-y-8">
        <PageHeader title="Your other paths" intro="Side work, buying a business, fractional work on the side. Your main focus keeps your weekly plan, and each path here adds one step." />
        {children}
      </div>
    </PreviewShell>
  )
}

// Needs income soon, nothing alongside yet: the recommendation shows.
export function OtherPathsNeedLive() {
  const details = { incomeNeed: 'now' }
  return (
    <Shell>
      <OtherPathsView main="LAID_OFF" journeyDetails={details} kinds={[]} cards={activePaths({ main: 'LAID_OFF', journeyDetails: details, kinds: [] })} buyStarted={false} />
    </Shell>
  )
}

// Side work and a buying plan next to a job search, with a way back.
export function OtherPathsBusyLive() {
  const details = {
    incomeNeed: 'soon',
    buy: { stage: 'search', why: 'income' },
    alongside: { side: { hours: 6, income: 1500, goal: 'cover' }, previousMain: 'EXPLORING_MOVE' },
  }
  const kinds = ['CONSULTING', 'FRACTIONAL']
  return (
    <Shell>
      <OtherPathsView main="BUY_BUSINESS" journeyDetails={details} kinds={kinds} cards={activePaths({ main: 'BUY_BUSINESS', journeyDetails: details, kinds })} buyStarted />
    </Shell>
  )
}
