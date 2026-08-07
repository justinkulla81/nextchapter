import Link from 'next/link'

// One rollup line for the Weekly Sprint card, replacing what used to be up
// to 15 individual "+5 pts, one-time" rows scattered across the committed
// list — mixing a 5-point profile confirm with a 30-point coffee chat made
// the weekly checklist long and made very different amounts of effort look
// equivalent. Disappears entirely once every item is done (see
// getProfileChecklistStatus).
export function ProfileChecklistCard({
  remainingCount,
  remainingPoints,
}: {
  remainingCount: number
  remainingPoints: number
}) {
  if (remainingCount === 0) return null

  return (
    <Link
      href="/dashboard/complete-profile"
      className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-brand/40 bg-brand/5 p-4 hover:bg-brand/10"
    >
      <div>
        <p className="text-sm font-medium text-foreground">Complete your profile</p>
        <p className="text-xs text-muted-foreground">
          {remainingCount} quick one-time item{remainingCount === 1 ? '' : 's'} left — none of this counts
          toward this week&apos;s goal pace, it&apos;s separate setup work.
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand tabular-nums">
        {remainingPoints} pts left
      </span>
    </Link>
  )
}
