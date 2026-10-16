import { Compass, X } from 'lucide-react'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { loadPivotPaths, type PivotProfile } from '@/lib/pivots/load'
import { shouldOfferPivotPaths } from '@/lib/pivots/scoring'

/** Shown on the board while it is narrowed to one pivot path. */
export function PivotBoardBanner({
  target,
  label,
  openTotal,
  clearHref = '/dashboard/find-my-job#job-recommendations',
}: {
  target: string
  label: string
  openTotal: number
  /** "Show all jobs": the board without the pivot filter, every other parameter (search, filters) kept. */
  clearHref?: string
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-brand/5 px-3 py-2 text-sm" role="status">
      <span className="text-foreground">
        Showing <span className="font-medium">{label.toLowerCase()}</span> jobs from your pivot paths ({openTotal.toLocaleString()} open), mid-level included.
      </span>
      <span className="flex items-center gap-3">
        <TrackedLink href="/dashboard/pivot-paths" event="pivot_paths_opened" properties={{ surface: 'board_filter', target }} className="text-primary underline underline-offset-4">
          Back to pivot paths
        </TrackedLink>
        <TrackedLink
          href={clearHref}
          event="pivot_board_filter_cleared"
          properties={{ target }}
          className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
        >
          <X className="size-3.5" aria-hidden />
          Show all jobs
        </TrackedLink>
      </span>
    </div>
  )
}

/**
 * On the board, for members who are pivoting or whose own work is contracting:
 * one line pointing to their pivot paths. Streams in on its own; renders
 * nothing otherwise or on any error, so the board never waits on or fails because of it.
 */
export async function PivotBoardPrompt({ profile }: { profile: PivotProfile }) {
  let result: Awaited<ReturnType<typeof loadPivotPaths>>
  try {
    result = await loadPivotPaths(profile)
  } catch (error) {
    console.error('Pivot board prompt: load failed', error)
    return null
  }
  if (!result.source || result.suggestions.length === 0 || !shouldOfferPivotPaths(profile, result.contraction)) return null
  const top = result.suggestions.slice(0, 3).map((s) => s.label.toLowerCase())
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
      <Compass className="size-4 text-muted-foreground" aria-hidden />
      <span className="text-foreground">
        {result.contraction.contracting ? result.contraction.headline : `Your skills map to ${top.join(', ')}.`}
      </span>
      <TrackedLink
        href="/dashboard/pivot-paths"
        event="pivot_paths_opened"
        properties={{ surface: 'board_prompt', contracting: result.contraction.contracting, sourceRole: result.source.key }}
        className="text-primary underline underline-offset-4"
      >
        See pivot paths
      </TrackedLink>
    </div>
  )
}
