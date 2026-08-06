import type { Grade } from '@/lib/scoring/grade'

// Sits between the visible and locked A-List teaser cards on the Jobs page
// — a one-line signal of exactly what's blocking their A, without a wall
// of extra explanation the candidate already sees on their dashboard.
export function UnlockAListCallout({ grade, lockedCount }: { grade: Grade; lockedCount: number }) {
  const opportunityWord = lockedCount === 1 ? 'opportunity' : 'opportunities'

  return (
    <div className="rounded-lg border border-orange/30 bg-orange/5 p-4">
      <p className="text-sm font-medium text-foreground">
        {lockedCount} A-List-exclusive {opportunityWord} unlock at an A grade — you&apos;re currently a {grade}.
      </p>
    </div>
  )
}
