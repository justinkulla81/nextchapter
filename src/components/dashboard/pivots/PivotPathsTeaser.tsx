import { ArrowRight } from 'lucide-react'
import { loadPivotPaths, type PivotProfile } from '@/lib/pivots/load'
import { demandLine } from '@/lib/pivots/scoring'
import { isPivotingProfile } from '@/lib/journey/pivot-target'
import { pivotJobsHref } from '@/lib/pivots/pivot-map'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { cn } from '@/lib/utils'
import { PivotPathsViewedBeacon } from './PivotPathsViewedBeacon'

/**
 * Pivot paths entry on Search Strategy: the top three paths with fit label and
 * local demand, and a link to the full page. Prominent when the member is
 * pivoting or their own work is contracting; otherwise a single quiet line.
 * Renders nothing if it can't load — Search Strategy must never fail on it.
 */
export async function PivotPathsTeaser({ profile }: { profile: PivotProfile }) {
  let result: Awaited<ReturnType<typeof loadPivotPaths>>
  try {
    result = await loadPivotPaths(profile)
  } catch (error) {
    console.error('Pivot paths teaser: load failed', error)
    return null
  }
  if (!result.source || result.suggestions.length === 0) return null
  const prominent = isPivotingProfile(profile) || result.contraction.contracting
  const source = { surface: 'search_strategy', sourceRole: result.source.key, contracting: result.contraction.contracting }

  if (!prominent) {
    return (
      <p className="text-sm text-muted-foreground">
        Thinking about a change?{' '}
        <TrackedLink href="/dashboard/pivot-paths" event="pivot_paths_opened" properties={source} className="text-primary underline underline-offset-4">
          See where your skills carry over
        </TrackedLink>
      </p>
    )
  }

  return (
    <div className={cn('space-y-3 rounded-lg border p-4', result.contraction.contracting ? 'border-warning/40 bg-warning/5' : 'border-border bg-card')}>
      <div>
        <p className="text-sm font-semibold text-foreground">Pivot paths for you</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.contraction.headline ?? `Where ${result.source.label.toLowerCase()} skills carry over, ranked by fit and by jobs open now.`}
        </p>
      </div>
      <PivotPathsViewedBeacon
        properties={{
          count: Math.min(3, result.suggestions.length),
          sourceFunction: profile.primaryFunction,
          sourceRole: result.source.key,
          contracting: result.contraction.contracting,
          marketReady: result.marketReady,
          targets: result.suggestions.slice(0, 3).map((s) => s.target),
          surface: 'search_strategy',
        }}
      />
      <ul className="space-y-2">
        {result.suggestions.slice(0, 3).map((s, i) => (
          <li key={s.target} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm text-foreground">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground"> · {s.fitLabel}</span>
              {result.marketReady && <span className="block text-xs text-muted-foreground">{demandLine(s.demand)}</span>}
            </span>
            <TrackedLink
              href={pivotJobsHref(s.target)}
              event="pivot_path_jobs_clicked"
              properties={{ ...source, target: s.target, rank: i + 1, fitLabel: s.fitLabel }}
              className="text-sm text-primary underline underline-offset-4"
            >
              Show me these jobs
            </TrackedLink>
          </li>
        ))}
      </ul>
      <TrackedLink
        href="/dashboard/pivot-paths"
        event="pivot_paths_opened"
        properties={source}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4"
      >
        See all your pivot paths, skills to add and pay
        <ArrowRight className="size-3.5" aria-hidden />
      </TrackedLink>
    </div>
  )
}
