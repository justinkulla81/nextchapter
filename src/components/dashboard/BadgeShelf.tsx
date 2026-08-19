import type { WeeklyBadgeStatus } from '@/lib/badges/weekly-badges'
import type { MilestoneBadgeStatus } from '@/lib/badges/milestone-badges'
import { StatusIcon } from '@/components/ui/status-icon'
import { cn } from '@/lib/utils'

// Weekly vs. milestone badges are two different real distinctions (one
// resets, one doesn't) — but on the dashboard's compact "Badges" box that
// distinction isn't worth two full section headers' worth of space. There
// it collapses into one flat, earned-first grid with a small corner glyph
// marking which kind each badge is; the Stats page keeps the full
// two-shelf breakdown (see the plain `<Shelf>` calls in BadgeShelf below,
// still used there via `combined={false}` — the default).
type BadgeKind = 'weekly' | 'milestone'
const KIND_GLYPH: Record<BadgeKind, string> = { weekly: '⚡', milestone: '🏅' }
const KIND_LABEL: Record<BadgeKind, string> = { weekly: 'Weekly badge — resets each week', milestone: 'Milestone badge — earned once, permanent' }

// Earned badges lead each shelf at full size; not-yet-earned badges follow,
// minimized to small icon-only chips — still visible (never hidden
// entirely, so a candidate can always see what's achievable) but
// de-emphasized so the earned wins are what stand out. The hover title on
// every tile is the badge's plain-language description — the only place
// that explanation lives, so hovering is how a name like "Reference
// Requested" (or a locked chip that's just an icon) becomes self-explanatory.
function BadgeTile({
  label,
  description,
  count,
  kind,
}: {
  label: string
  description: string
  count?: number
  kind?: BadgeKind
}) {
  return (
    <div
      className="relative flex flex-col items-center gap-1 rounded-lg border border-brand/30 bg-brand/5 p-3 text-center"
      title={kind ? `${label} — ${description} (${KIND_LABEL[kind]})` : description}
    >
      {kind && (
        <span className="absolute top-1 right-1 text-[10px] leading-none" aria-hidden>
          {KIND_GLYPH[kind]}
        </span>
      )}
      <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-lg">🏅</span>
      <p className="text-xs font-medium text-foreground">
        {label}
        {count && count > 1 ? ` ×${count}` : ''}
      </p>
    </div>
  )
}

function LockedBadgeChip({ label, description, kind }: { label: string; description: string; kind?: BadgeKind }) {
  return (
    <div
      className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/30 opacity-50 grayscale"
      title={kind ? `${label} — ${description} (${KIND_LABEL[kind]})` : `${label} — ${description}`}
    >
      <StatusIcon status="locked" size={14} />
    </div>
  )
}

function sortEarnedFirst<T extends { earned: boolean }>(badges: T[]): T[] {
  return [...badges].sort((a, b) => Number(b.earned) - Number(a.earned))
}

type AnyBadge = { key: string; label: string; description: string; earned: boolean; count?: number }

function Shelf<T extends AnyBadge>({
  title,
  badges,
  gridCols,
  showLocked,
  kind,
}: {
  title: string
  badges: T[]
  gridCols: string
  // Every locked slot is shown the first time a candidate ever sees this
  // shelf, so they can see the full 32-badge board up front — after that,
  // an always-visible wall of grayed-out locks reads as noise, so only
  // what's actually been earned stays on display.
  showLocked: boolean
  kind?: BadgeKind
}) {
  const sorted = sortEarnedFirst(badges)
  const earned = sorted.filter((b) => b.earned)
  const locked = sorted.filter((b) => !b.earned)
  return (
    <div>
      {title && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>}
      {earned.length > 0 && (
        <div className={cn('mt-2 grid gap-2', gridCols)}>
          {earned.map((b) => (
            <BadgeTile key={b.key} label={b.label} description={b.description} count={b.count} kind={kind} />
          ))}
        </div>
      )}
      {earned.length === 0 && !showLocked && (
        <p className="mt-2 text-xs text-muted-foreground">None earned yet.</p>
      )}
      {locked.length > 0 && showLocked && (
        <div className={cn('flex flex-wrap gap-1.5', earned.length > 0 ? 'mt-3' : 'mt-2')}>
          {locked.map((b) => (
            <LockedBadgeChip key={b.key} label={b.label} description={b.description} kind={kind} />
          ))}
        </div>
      )}
    </div>
  )
}

export function BadgeShelf({
  weeklyBadges,
  milestoneBadges,
  showLocked = true,
  combined = false,
}: {
  weeklyBadges: WeeklyBadgeStatus[]
  milestoneBadges: MilestoneBadgeStatus[]
  // Defaults true so every other existing caller (e.g. the Stats page's
  // full badge board) keeps showing the complete locked set unless it
  // opts into the dashboard top strip's first-visit-only behavior.
  showLocked?: boolean
  // The dashboard top strip's compact view — one flat grid instead of two
  // titled shelves, distinguishing weekly vs. milestone with a small corner
  // glyph only. The Stats page never passes this, so it keeps the full,
  // clearly-labeled two-shelf breakdown.
  combined?: boolean
}) {
  if (combined) {
    const merged: (AnyBadge & { kind: BadgeKind })[] = [
      ...weeklyBadges.map((b) => ({ ...b, kind: 'weekly' as const })),
      ...milestoneBadges.map((b) => ({ ...b, kind: 'milestone' as const })),
    ]
    const earned = sortEarnedFirst(merged).filter((b) => b.earned)
    const locked = sortEarnedFirst(merged).filter((b) => !b.earned)
    return (
      <div>
        {earned.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {earned.map((b) => (
              <BadgeTile key={b.key} label={b.label} description={b.description} count={b.count} kind={b.kind} />
            ))}
          </div>
        )}
        {earned.length === 0 && !showLocked && <p className="text-xs text-muted-foreground">None earned yet.</p>}
        {locked.length > 0 && showLocked && (
          <div className={cn('flex flex-wrap gap-1.5', earned.length > 0 ? 'mt-3' : '')}>
            {locked.map((b) => (
              <LockedBadgeChip key={b.key} label={b.label} description={b.description} kind={b.kind} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Shelf title="This week's badges" badges={weeklyBadges} gridCols="grid-cols-3 sm:grid-cols-4" showLocked={showLocked} kind="weekly" />
      <Shelf title="Milestones" badges={milestoneBadges} gridCols="grid-cols-3 sm:grid-cols-5" showLocked={showLocked} kind="milestone" />
    </div>
  )
}
