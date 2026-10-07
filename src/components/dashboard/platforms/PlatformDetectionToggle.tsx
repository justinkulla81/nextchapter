'use client'

import { useState, useTransition } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Button } from '@/components/ui/button'
import { dismissPlatformDetection, restorePlatformDetection } from '@/app/dashboard/platforms/actions'

// "Not right?" on a detected platform: a two-step remove (reversible with
// Restore) so one stray click never hides real progress.
export function PlatformDetectionToggle({ platformKey, name, dismissed }: { platformKey: string; name: string; dismissed: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const posthog = usePostHog()

  function run(action: 'remove' | 'restore') {
    posthog?.capture(action === 'remove' ? 'platform_detection_remove_clicked' : 'platform_detection_restore_clicked', { platform: platformKey })
    startTransition(async () => {
      await (action === 'remove' ? dismissPlatformDetection(platformKey) : restorePlatformDetection(platformKey))
      setConfirming(false)
    })
  }

  if (dismissed) {
    return (
      <Button variant="ghost" size="sm" className={pending ? 'cursor-wait' : undefined} disabled={pending} onClick={() => run('restore')}>
        {pending ? 'Restoring…' : 'Restore'}
      </Button>
    )
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirming(true)} aria-label={`Remove ${name} — this detection is wrong`}>
        Not right?
      </Button>
    )
  }

  return (
    <span className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">Remove {name}?</span>
      <Button variant="outline" size="sm" className={pending ? 'cursor-wait' : undefined} disabled={pending} onClick={() => run('remove')}>
        {pending ? 'Removing…' : 'Remove'}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
        Keep
      </Button>
    </span>
  )
}
