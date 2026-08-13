'use client'

import { useState } from 'react'
import { removeCuratedVideoAction, removePodcastAction } from '@/app/support/admin/(portal)/webinars/actions'
import { SubmitButton } from '@/components/ui/submit-button'

// Shared soft-delete control for CuratedVideo (video or Short) and Podcast
// rows — sets removedAt rather than deleting, same convention as
// CancelWebinarButton's cancelledAt. Confirmation step per
// design-principles.md ("destructive actions require explicit confirmation
// and must never be the default focus").
export function RemoveCuratedContentButton({
  kind,
  id,
  itemLabel,
}: {
  kind: 'video' | 'podcast'
  id: string
  itemLabel: string
}) {
  const [confirming, setConfirming] = useState(false)
  const action = kind === 'video' ? removeCuratedVideoAction : removePodcastAction

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
        <p className="text-sm font-medium text-foreground">Remove &quot;{itemLabel}&quot;?</p>
        <p className="text-xs text-muted-foreground">
          Candidates will no longer see this in the carousel. It can be re-added later.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Keep
          </button>
          <form action={action.bind(null, id)}>
            <SubmitButton size="sm" variant="destructive" onClick={() => setConfirming(false)}>
              Remove
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  )
}
