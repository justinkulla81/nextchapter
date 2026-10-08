'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Button } from '@/components/ui/button'
import { dismissPlatformDetection, restorePlatformDetection } from '@/app/dashboard/platforms/actions'

// One detected platform's row. "Not right?" is a two-step remove
// (reversible with Restore) so one stray click never hides real progress.
// Updates in place right away; the save runs in the background.
export function PlatformActivityItem({
  platformKey,
  name,
  initiallyDismissed,
  pill,
  children,
}: {
  platformKey: string
  name: string
  initiallyDismissed: boolean
  pill: ReactNode
  children: ReactNode
}) {
  const [dismissed, setDismissed] = useState(initiallyDismissed)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const posthog = usePostHog()

  function run(next: boolean) {
    posthog?.capture(next ? 'platform_detection_remove_clicked' : 'platform_detection_restore_clicked', { platform: platformKey })
    setDismissed(next)
    setConfirming(false)
    setError(null)
    startTransition(async () => {
      const result = await (next ? dismissPlatformDetection(platformKey) : restorePlatformDetection(platformKey)).catch(() => ({ ok: false }))
      if (!result.ok) {
        setDismissed(!next)
        setError('That didn’t save. Check your connection and try again.')
      }
    })
  }

  return (
    <li className={dismissed ? 'flex flex-wrap items-center gap-x-3 gap-y-1 py-3 opacity-60' : 'flex flex-wrap items-center gap-x-3 gap-y-1 py-3'}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{name}</span>
          {dismissed ? <span className="text-xs text-muted-foreground">Removed</span> : pill}
        </div>
        {children}
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
      {dismissed ? (
        <Button variant="ghost" size="sm" className={pending ? 'cursor-wait' : undefined} onClick={() => run(false)}>
          Restore
        </Button>
      ) : confirming ? (
        <span className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Remove {name}?</span>
          <Button variant="outline" size="sm" onClick={() => run(true)}>
            Remove
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </span>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className={pending ? 'cursor-wait text-muted-foreground' : 'text-muted-foreground'}
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${name}: this detection is wrong`}
        >
          Not right?
        </Button>
      )}
    </li>
  )
}
