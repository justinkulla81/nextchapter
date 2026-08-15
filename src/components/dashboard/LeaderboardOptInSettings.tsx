'use client'

import { useState, useTransition } from 'react'
import { setLeaderboardOptIn, setLeaderboardDisplayMode } from '@/app/dashboard/privacy/leaderboard-actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LeaderboardDisplayMode } from '@prisma/client'

const DISPLAY_MODE_OPTIONS: { value: LeaderboardDisplayMode; label: string; description: string }[] = [
  { value: 'FIRST_NAME_LAST_INITIAL', label: 'First name + last initial', description: 'e.g. "Marcus H."' },
  { value: 'GENERATED_HANDLE', label: 'Generated handle', description: 'A random handle nobody can trace back to you' },
  { value: 'NOT_LISTED', label: 'Not listed', description: "You're ranked and counted, but shown with no name at all" },
]

// PART FOUR §15 — opt-in, default off. Three display modes shown as
// adjacent buttons (design-principles.md: 2-4 discrete options -> buttons,
// not a dropdown). Never shows employer/title/location/industry anywhere in
// this component, per §15's "never displayed" list — only the 3 identity
// options above.
export function LeaderboardOptInSettings({
  optedIn,
  displayMode,
  confidentialSearchMode,
}: {
  optedIn: boolean
  displayMode: LeaderboardDisplayMode | null
  confidentialSearchMode: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [pendingMode, setPendingMode] = useState<LeaderboardDisplayMode | null>(displayMode)

  // §4.1 — hard exclusion. Not defaulted off with a visible toggle: the
  // opt-in control itself is never shown to a Confidential Search Mode
  // candidate. Their rank/personal bests/badges still compute and display
  // privately elsewhere (Stats page) — this section just never offers a way
  // to appear publicly while the mode is on.
  if (confidentialSearchMode) {
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="font-medium text-foreground">Weekly Leaderboards</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Unavailable while Confidential Search Mode is on — leaderboards are public by nature, which
          conflicts with staying invisible. You can still see your own rank, personal bests, and
          badges privately on your Stats page; they just never display to anyone else.
        </p>
      </div>
    )
  }

  function optIn(mode: LeaderboardDisplayMode) {
    setError(null)
    setPendingMode(mode)
    startTransition(async () => {
      const result = await setLeaderboardOptIn(true, mode)
      if (result?.error) setError(result.error)
    })
  }

  function optOut() {
    setError(null)
    startTransition(async () => {
      const result = await setLeaderboardOptIn(false)
      if (result?.error) setError(result.error)
    })
  }

  function changeMode(mode: LeaderboardDisplayMode) {
    setError(null)
    setPendingMode(mode)
    startTransition(async () => {
      const result = await setLeaderboardDisplayMode(mode)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className={cn('rounded-lg border border-border p-4 space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div>
        <p className="font-medium text-foreground">Weekly Leaderboards</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Opt in to see how your Action Score, Outreach, Applications, Visibility, and Contribution
          stack up against peers in your seniority band. Top 10 shown publicly, never a full ranking —
          your employer, title, location, and industry are never shown, no matter which option you
          pick below.
        </p>
      </div>

      {optedIn && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">How you appear on the leaderboard</p>
          <div className="flex flex-wrap gap-2">
            {DISPLAY_MODE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={pendingMode === opt.value ? 'default' : 'outline'}
                disabled={pending}
                onClick={() => changeMode(opt.value)}
                title={opt.description}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {optedIn ? (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={optOut}>
          Opt out of leaderboards
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Choose how you&apos;d appear, then opt in</p>
          <div className="flex flex-wrap gap-2">
            {DISPLAY_MODE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => optIn(opt.value)}
                title={opt.description}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
