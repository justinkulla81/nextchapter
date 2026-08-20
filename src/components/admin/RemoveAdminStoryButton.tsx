'use client'

import { useState } from 'react'
import { removeAdminStoryAction } from '@/app/support/admin/(portal)/community-stories/actions'
import { SubmitButton } from '@/components/ui/submit-button'

// Same confirm-then-soft-delete shape as RemoveCuratedContentButton — sets
// isActive: false rather than deleting, matching how a candidate's own
// "Remove" on their post already works.
export function RemoveAdminStoryButton({ postId }: { postId: string }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="shrink-0 text-xs font-medium text-destructive hover:underline"
      >
        Remove
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Remove this story?</p>
        <p className="text-xs text-muted-foreground">Candidates will no longer see it in the Community feed.</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Keep
          </button>
          <form action={removeAdminStoryAction.bind(null, postId)}>
            <SubmitButton size="sm" variant="destructive" onClick={() => setConfirming(false)}>
              Remove
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  )
}
