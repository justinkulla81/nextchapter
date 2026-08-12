'use client'

import { useState } from 'react'
import { cancelWebinarAction } from '@/app/support/admin/(portal)/webinars/actions'
import { SubmitButton } from '@/components/ui/submit-button'

export function CancelWebinarButton({ webinarId }: { webinarId: string }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-destructive hover:underline"
      >
        Cancel webinar
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Cancel this webinar?</p>
        <p className="text-xs text-muted-foreground">
          Registered candidates will no longer see it as upcoming. This can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Keep webinar
          </button>
          <form action={cancelWebinarAction.bind(null, webinarId)}>
            <SubmitButton size="sm" variant="destructive" onClick={() => setConfirming(false)}>
              Cancel webinar
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  )
}
