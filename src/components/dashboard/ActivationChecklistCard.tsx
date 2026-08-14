import Link from 'next/link'
import { after } from 'next/server'
import { Check, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getActivationItems,
  recordActivationChecklistCompletedOnce,
  type ActivationItem,
} from '@/lib/dashboard/activation-items'
import { getModuleGateStatus, type ModuleGateStatus } from '@/lib/scoring/dossier-unlock'
import { cn } from '@/lib/utils'

// Master Build Script §12, "Unified dashboard" — one dashboard, no separate
// onboarding surface. Three zones:
//   1. Activation items — always at top, never locked. Vanishes entirely
//      (this whole zone, not the card) once all four are complete — no
//      congratulatory shell, no empty state.
//   2. Always-unlocked extras — no prior step, no other person required.
//      Always rendered, lighter visual weight than an open activation row.
//   3. Everything else — grayed and locked, title + unlock condition only,
//      sourced from getModuleGateStatus() (dossier-unlock.ts).

// Not really "minutes" for the one-click connect item (§12: "1 click") —
// special-cased here rather than widening ActivationItem's type for one
// row. 0 minutes (Market Reality Report — no estimate given in §12, and no
// "reviewed" signal exists to gate a real completion state on) hides the
// time badge entirely rather than showing "0 min".
function formatEstimate(item: ActivationItem): string | null {
  if (item.key === 'connectAccounts') return '1 click'
  if (item.estimatedMinutes <= 0) return null
  return `${item.estimatedMinutes} min`
}

// A completed item collapses to a single low-visual-weight checked line —
// same "done, out of the way" treatment for both a finished activation item
// and an always-unlocked extra. An open item is a full clickable row;
// `emphasized` is what separates a still-blocking activation row (bold,
// bordered) from an always-unlocked row that's merely available (lighter,
// per §12: "never show a locked state for these").
function ChecklistRow({ item, emphasized }: { item: ActivationItem; emphasized: boolean }) {
  if (item.complete) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Check className="size-3.5 shrink-0 text-success" aria-hidden />
        <span className="truncate text-xs text-muted-foreground line-through">{item.label}</span>
      </div>
    )
  }

  const time = formatEstimate(item)

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/40',
        emphasized ? 'border border-border' : 'border border-transparent'
      )}
    >
      <span
        className={cn(
          'text-sm',
          emphasized ? 'font-medium text-foreground' : 'text-muted-foreground'
        )}
      >
        {item.label}
      </span>
      {time && (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {time}
        </span>
      )}
    </Link>
  )
}

// Zone 3 row — locked entries get the established orange-accent/lock-icon
// treatment (see LockedFeatureNotice); the rare already-unlocked entry
// mixed into getModuleGateStatus()'s output (e.g. a candidate who already
// sent a reference request) gets a plain checked row instead of a fake
// locked one. No href on either — ModuleGateStatus carries no route, and a
// locked row must not be clickable in the first place (that's the point of
// "locked" — see design-principles.md on never disabling without
// explanation, satisfied here by `reason` always being shown).
function ModuleGateRow({ status }: { status: ModuleGateStatus }) {
  return (
    <div className="flex items-start gap-2 rounded-lg px-3 py-2">
      {status.unlocked ? (
        <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
      ) : (
        <Lock className="mt-0.5 size-3.5 shrink-0 text-orange" aria-hidden />
      )}
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', status.unlocked ? 'text-foreground' : 'text-muted-foreground')}>
          {status.label}
        </p>
        <p className="text-xs text-muted-foreground">{status.reason}</p>
      </div>
    </div>
  )
}

export async function ActivationChecklistCard({ candidateId }: { candidateId: string }) {
  const [{ activationItems, alwaysUnlockedItems, allActivationComplete }, moduleGateStatus] = await Promise.all([
    getActivationItems(candidateId),
    getModuleGateStatus(candidateId),
  ])

  // §12: "Locked items sort below unlocked ones within their group" — for
  // this zone (sourced from a list that mixes locked and unlocked module
  // gates) that means unlocked entries surface above locked ones, not that
  // the whole zone is uniformly locked. Array.prototype.sort is stable, so
  // relative order within each bucket is preserved.
  const sortedModuleGateStatus = [...moduleGateStatus].sort((a, b) => Number(b.unlocked) - Number(a.unlocked))

  // Deferred so a completed-checklist page load never waits on this write —
  // see recordActivationChecklistCompletedOnce's own comment for why the
  // "already fired" check matters here and isn't overbuilt caution.
  if (allActivationComplete) {
    after(() => recordActivationChecklistCompletedOnce(candidateId))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Get started</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Zone 1 — vanishes entirely once complete. No success banner, no
            empty state left in its place. */}
        {!allActivationComplete && (
          <div className="space-y-1">
            {activationItems.map((item) => (
              <ChecklistRow key={item.key} item={item} emphasized />
            ))}
          </div>
        )}

        {/* Zone 2 — always unlocked, always shown, lighter weight. */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-medium text-muted-foreground">Also available now</p>
          {alwaysUnlockedItems.map((item) => (
            <ChecklistRow key={item.key} item={item} emphasized={false} />
          ))}
        </div>

        {/* Zone 3 — everything else, grayed and locked (title + unlock
            condition only), unlocked-first within the group. */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-medium text-muted-foreground">Unlocks as you go</p>
          {sortedModuleGateStatus.map((status) => (
            <ModuleGateRow key={status.key} status={status} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
