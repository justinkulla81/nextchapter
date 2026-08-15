'use client'

import { useEffect, useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConfidentialModeOffConfirmation } from '@/components/dashboard/ConfidentialModeOffConfirmation'
import { setConfidentialSearchMode } from '@/app/dashboard/privacy/actions'
import { recordPassiveToActivePromptShown, respondToPassiveToActivePrompt } from '@/app/dashboard/actions'
import type { PassiveToActiveTrigger } from '@/lib/dashboard/passive-to-active-prompt'

// §10 — "Has anything changed?" Shown only to members in Confidential
// Search Mode when evaluatePassiveToActivePrompt (src/lib/dashboard/
// passive-to-active-prompt.ts) finds a real trigger on dashboard load. Once,
// without pressure: never implies passive searching was wrong — see the
// copy below, which stays affirming ("makes sense when you're still
// employed") rather than corrective.
export function PassiveToActivePromptCard({ trigger }: { trigger: PassiveToActiveTrigger }) {
  const [dismissed, setDismissed] = useState(false)
  const [confirmingOpenUp, setConfirmingOpenUp] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Fires exactly once, the moment the card is actually painted for the
  // member — this is what starts the real 30-day throttle (see the comment
  // on recordPassiveToActivePromptShown). Deliberately not done during
  // server render: evaluatePassiveToActivePrompt is read-only so repeated
  // computes (prefetch, React re-render) never cost the member their
  // 30-day window on their behalf.
  useEffect(() => {
    startTransition(() => {
      recordPassiveToActivePromptShown(trigger)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (dismissed) return null

  function openUp() {
    setError(null)
    startTransition(async () => {
      // Reuses the exact Phase A toggle-off path (spec §3's "confirmation
      // naming exactly what becomes visible") — this never sets
      // confidentialSearchMode itself, so there is only ever one place in
      // the codebase that turns the mode off.
      const result = await setConfidentialSearchMode(false, true)
      if (result?.error) {
        setError(result.error)
        return
      }
      await respondToPassiveToActivePrompt('OPENED_UP', trigger)
      setDismissed(true)
    })
  }

  function notYet() {
    setDismissed(true)
    startTransition(() => {
      respondToPassiveToActivePrompt('NOT_YET', trigger)
    })
  }

  function dontAskAgain() {
    setDismissed(true)
    startTransition(() => {
      respondToPassiveToActivePrompt('DONT_ASK_AGAIN', trigger)
    })
  }

  return (
    <Card className={cn('border-brand/30 bg-brand/5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <CardContent className="space-y-3 pt-6">
        <p className="text-sm font-medium text-foreground">Has anything changed?</p>
        <p className="text-sm text-muted-foreground">
          You&apos;ve been searching quietly, which makes sense when you&apos;re still employed. If your
          situation has shifted, opening up unlocks a few things: posting to LinkedIn, the leaderboards,
          the community under your own name, and broader outreach.
        </p>

        {!confirmingOpenUp && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => setConfirmingOpenUp(true)}>
              Something&apos;s changed — open up my search
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={notYet}>
              Not yet
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={dontAskAgain}>
              Don&apos;t ask again
            </Button>
          </div>
        )}

        {confirmingOpenUp && (
          <ConfidentialModeOffConfirmation
            pending={pending}
            onConfirm={openUp}
            onCancel={() => setConfirmingOpenUp(false)}
            confirmLabel="Confirm — open up my search"
          />
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
