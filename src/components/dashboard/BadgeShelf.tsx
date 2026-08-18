import type { WeeklyBadgeStatus } from '@/lib/badges/weekly-badges'
import type { MilestoneBadgeStatus } from '@/lib/badges/milestone-badges'
import { StatusIcon } from '@/components/ui/status-icon'
import { cn } from '@/lib/utils'

// Weekly and milestone badges display in visually distinct shelves, never
// merged into one grid (Prompt 51). Earned badges lead each shelf at full
// size; not-yet-earned badges follow, minimized to small icon-only chips —
// still visible (never hidden entirely, so a candidate can always see
// what's achievable) but de-emphasized so the earned wins are what stand out.
function BadgeTile({
  label,
  description,
  count,
}: {
  label: string
  description: string
  count?: number
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-brand/30 bg-brand/5 p-3 text-center" title={description}>
      <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-lg">🏅</span>
      <p className="text-xs font-medium text-foreground">
        {label}
        {count && count > 1 ? ` ×${count}` : ''}
      </p>
    </div>
  )
}

function LockedBadgeChip({ label, description }: { label: string; description: string }) {
  return (
    <div
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/30 opacity-50 grayscale"
      title={`${label} — ${description}`}
    >
      <StatusIcon status="locked" size={14} />
    </div>
  )
}

function sortEarnedFirst<T extends { earned: boolean }>(badges: T[]): T[] {
  return [...badges].sort((a, b) => Number(b.earned) - Number(a.earned))
}

function Shelf<T extends { key: string; label: string; description: string; earned: boolean; count?: number }>({
  title,
  badges,
  gridCols,
}: {
  title: string
  badges: T[]
  gridCols: string
}) {
  const sorted = sortEarnedFirst(badges)
  const earned = sorted.filter((b) => b.earned)
  const locked = sorted.filter((b) => !b.earned)
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {earned.length > 0 && (
        <div className={cn('mt-2 grid gap-2', gridCols)}>
          {earned.map((b) => (
            <BadgeTile key={b.key} label={b.label} description={b.description} count={b.count} />
          ))}
        </div>
      )}
      {locked.length > 0 && (
        <div className={cn('flex flex-wrap gap-1.5', earned.length > 0 ? 'mt-3' : 'mt-2')}>
          {locked.map((b) => (
            <LockedBadgeChip key={b.key} label={b.label} description={b.description} />
          ))}
        </div>
      )}
    </div>
  )
}

export function BadgeShelf({
  weeklyBadges,
  milestoneBadges,
}: {
  weeklyBadges: WeeklyBadgeStatus[]
  milestoneBadges: MilestoneBadgeStatus[]
}) {
  return (
    <div className="space-y-6">
      <Shelf title="This week's badges" badges={weeklyBadges} gridCols="grid-cols-3 sm:grid-cols-4" />
      <Shelf title="Milestones" badges={milestoneBadges} gridCols="grid-cols-3 sm:grid-cols-5" />
    </div>
  )
}
