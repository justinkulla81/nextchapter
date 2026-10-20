'use client'

import { useState, useTransition } from 'react'
import { Lock } from 'lucide-react'
import { setConfidentialSearchMode } from '@/app/dashboard/privacy/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConfidentialModeOffConfirmation } from '@/components/dashboard/ConfidentialModeOffConfirmation'
import { CONFIDENTIAL_MODE_UNCHANGED_ITEMS } from '@/lib/constants/confidential-mode-copy'

// Settings toggle for Confidential Search Mode (spec §3, §6). Turning it ON
// is immediate — no confirmation. Turning it OFF requires a confirmation
// step naming exactly what becomes visible, so this mirrors
// DeleteAccountForm's inline-expand pattern (the closest existing
// precedent in this codebase for a visibility/consequence-bearing
// confirmation) rather than introducing a new modal system.
export function ConfidentialModeToggle({ enabled, redesign = false }: { enabled: boolean; redesign?: boolean }) {
  const [confirmingOff, setConfirmingOff] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function turnOn() {
    setError(null)
    startTransition(async () => {
      const result = await setConfidentialSearchMode(true, false)
      if (result?.error) setError(result.error)
    })
  }

  function confirmTurnOff() {
    setError(null)
    startTransition(async () => {
      const result = await setConfidentialSearchMode(false, true)
      if (result?.error) setError(result.error)
      else setConfirmingOff(false)
    })
  }

  // The redesign: the page's heading already names this setting, so the control says what is true now and offers the one
  // change. The off-confirmation, and what stays the same either way, are unchanged.
  if (redesign) {
    return (
      <div className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
        <p className="max-w-xl text-base text-ink">
          {enabled
            ? 'On. Nothing you do here is visible to other members or outside NextChapter.'
            : 'Off. Your activity can be visible to other members and, where you choose to share it, outside NextChapter.'}
        </p>
        {!enabled && (
          <button type="button" disabled={pending} onClick={turnOn} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-70">
            {pending ? 'Turning on…' : 'Turn on Confidential Search Mode'}
          </button>
        )}
        {enabled && !confirmingOff && (
          <button type="button" disabled={pending} onClick={() => setConfirmingOff(true)} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-70">
            Turn off
          </button>
        )}
        {enabled && confirmingOff && <ConfidentialModeOffConfirmation pending={pending} onConfirm={confirmTurnOff} onCancel={() => setConfirmingOff(false)} />}
        {error && (
          <p role="alert" className="text-base text-destructive">
            {error}
          </p>
        )}
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-ink select-none">What stays exactly the same either way</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {CONFIDENTIAL_MODE_UNCHANGED_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="flex items-start gap-2">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">Confidential Search Mode</p>
          <p className="text-sm text-muted-foreground">
            {enabled
              ? 'Nothing you do here is visible to other members or outside NextChapter.'
              : 'Off. Your activity can be visible to other members and, where you choose to share it, outside NextChapter.'}
          </p>
        </div>
      </div>

      {!enabled && (
        <Button size="sm" disabled={pending} onClick={turnOn}>
          Turn on Confidential Search Mode
        </Button>
      )}

      {enabled && !confirmingOff && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirmingOff(true)}>
          Turn off
        </Button>
      )}

      {enabled && confirmingOff && (
        <ConfidentialModeOffConfirmation
          pending={pending}
          onConfirm={confirmTurnOff}
          onCancel={() => setConfirmingOff(false)}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer select-none font-medium text-foreground">
          What stays exactly the same either way
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {CONFIDENTIAL_MODE_UNCHANGED_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}
