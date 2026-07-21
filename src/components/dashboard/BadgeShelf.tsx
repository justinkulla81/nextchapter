import type { WeeklyBadgeStatus } from '@/lib/badges/weekly-badges'
import type { MilestoneBadgeStatus } from '@/lib/badges/milestone-badges'
import { cn } from '@/lib/utils'

// Weekly and milestone badges display in visually distinct shelves, never
// merged into one grid (Prompt 51). Earned badges show in full color;
// not-yet-earned stay visible but grayed/locked — never hidden entirely,
// so a candidate can always see what's achievable.
function BadgeTile({
  label,
  description,
  earned,
  count,
}: {
  label: string
  description: string
  earned: boolean
  count?: number
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg border p-3 text-center',
        earned ? 'border-brand/30 bg-brand/5' : 'border-border bg-muted/30 opacity-50 grayscale'
      )}
      title={description}
    >
      <span className={cn('flex size-10 items-center justify-center rounded-full text-lg', earned ? 'bg-brand/15' : 'bg-muted')}>
        {earned ? '🏅' : '🔒'}
      </span>
      <p className="text-xs font-medium text-foreground">
        {label}
        {count && count > 1 ? ` ×${count}` : ''}
      </p>
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
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          This week&apos;s badges
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {weeklyBadges.map((b) => (
            <BadgeTile key={b.key} label={b.label} description={b.description} earned={b.earned} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Milestones</p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {milestoneBadges.map((b) => (
            <BadgeTile key={b.key} label={b.label} description={b.description} earned={b.earned} count={b.count} />
          ))}
        </div>
      </div>
    </div>
  )
}
