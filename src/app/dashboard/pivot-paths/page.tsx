import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { Compass, TriangleAlert } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { loadPivotPaths } from '@/lib/pivots/load'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { PivotPathsList } from '@/components/dashboard/pivots/PivotPathsList'
import { PeopleEnergyQuestion } from '@/components/dashboard/pivots/PeopleEnergyQuestion'
import { WorkStylePrompt } from '@/components/dashboard/WorkStylePrompt'

export const metadata: Metadata = { title: 'Pivot paths' }

export default async function PivotPathsPage() {
  const profile = await getDashboardProfile()
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pivot paths</h1>
        <p className="text-muted-foreground">
          Where your skills carry over, ranked by how well you fit, how many of these jobs are open near you and nationally, and what they pay.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
            <Spinner size={16} />
            Matching your skills to the job market…
          </div>
        }
      >
        <PivotPathsBody profile={profile} />
      </Suspense>
    </div>
  )
}

async function PivotPathsBody({ profile }: { profile: Awaited<ReturnType<typeof getDashboardProfile>> }) {
  let result: Awaited<ReturnType<typeof loadPivotPaths>>
  try {
    result = await loadPivotPaths(profile)
  } catch (error) {
    console.error('Pivot paths: load failed', error)
    return (
      <EmptyState
        icon={TriangleAlert}
        title="We couldn't load your pivot paths"
        description="Something went wrong reading the job market. Refresh the page in a minute; if it keeps happening, tell us from the Help page."
      />
    )
  }

  if (!result.source) {
    return (
      <EmptyState
        icon={Compass}
        title="Tell us what you do now"
        description="Pivot paths start from your current role. Add your most recent job title or your main function in Search Strategy, and we'll map where your skills carry over."
        cta={{ label: 'Open Search Strategy', href: '/dashboard/search-strategy' }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {result.contraction.contracting && (
        <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/5 p-4" role="note">
          <p className="text-sm font-semibold text-foreground">{result.contraction.headline}</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {result.contraction.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Starting from: <span className="font-medium text-foreground">{result.source.label}</span>
        {profile.highestLevelReached && <> at {profile.highestLevelReached.toLowerCase()} level</>}.{' '}
        <Link href="/dashboard/search-strategy" className="text-primary underline underline-offset-4">
          Not right? Update it
        </Link>
      </p>

      <PeopleEnergyQuestion current={result.energy} source={result.energySource} />

      <WorkStylePrompt candidateId={profile.id} limit={4} />

      <PivotPathsList
        suggestions={result.suggestions}
        more={result.more}
        hidden={result.hidden}
        sourceFunction={profile.primaryFunction}
        sourceRole={result.source.key}
        contracting={result.contraction.contracting}
        marketReady={result.marketReady}
        surface="pivot_paths_page"
      />

      <p className="text-xs text-muted-foreground">
        Job counts come from the live NextChapter job board at a level you could realistically land, refreshed nightly. Trends compare each
        role&apos;s share of new postings with the period before, and appear once there is enough history. Pay is the typical posted salary
        where enough jobs list one. Layoff notices are state WARN filings across all employers. Long-term outlook and median wages are national BLS figures (Employment Projections and OEWS) via CareerOneStop, refreshed yearly.
      </p>
    </div>
  )
}
