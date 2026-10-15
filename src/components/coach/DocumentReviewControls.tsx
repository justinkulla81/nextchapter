'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cancelRequest, reviewDocument, type CoachDocumentState } from '@/app/support/coach/(app)/clients/[token]/[clientId]/documents/actions'

function Feedback({ state }: { state: CoachDocumentState }) {
  return (
    <>
      {state?.message && (
        <p role="status" className="text-xs text-muted-foreground">
          {state.message}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </>
  )
}

// Accepting is the one primary action on an uploaded file. Asking for changes needs a note, so
// the candidate knows what to fix.
export function DocumentReviewControls({ token, clientId, requestId }: { token: string; clientId: string; requestId: string }) {
  const [accepted, acceptAction] = useActionState(reviewDocument.bind(null, token, clientId, requestId, 'ACCEPTED'), undefined)
  const [changes, changesAction] = useActionState(reviewDocument.bind(null, token, clientId, requestId, 'NEEDS_CHANGES'), undefined)
  const [asking, setAsking] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={acceptAction}>
          <SubmitButton size="sm" pendingLabel="Accepting…" savedLabel="Accept document">
            Accept document
          </SubmitButton>
        </form>
        {!asking && (
          <Button type="button" size="sm" variant="outline" onClick={() => setAsking(true)}>
            Ask for changes
          </Button>
        )}
      </div>
      <Feedback state={accepted} />
      {asking && (
        <form action={changesAction} className="space-y-2">
          <Label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">What needs to change?</span>
            <Textarea name="note" rows={3} required maxLength={2000} autoFocus />
          </Label>
          <div className="flex flex-wrap gap-2">
            <SubmitButton size="sm" variant="outline" pendingLabel="Sending…" savedLabel="Send back with this note">
              Send back with this note
            </SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(false)}>
              Never mind
            </Button>
          </div>
          <Feedback state={changes} />
        </form>
      )}
    </div>
  )
}

// Cancelling a request is hard to undo for the candidate (it vanishes from their list), so it asks first.
export function CancelRequestButton({ token, clientId, requestId, title }: { token: string; clientId: string; requestId: string; title: string }) {
  const [state, action] = useActionState(async () => cancelRequest(token, clientId, requestId), undefined)
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={`Cancel the request for ${title}`}>
        Cancel request
      </Button>
    )
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label={`Confirm cancelling the request for ${title}`}>
      <span className="text-xs text-foreground">Cancel this request?</span>
      <Button type="button" size="sm" autoFocus onClick={() => setConfirming(false)}>
        Keep request
      </Button>
      <SubmitButton size="sm" variant="destructive" pendingLabel="Cancelling…" savedLabel="Cancel request">
        Cancel request
      </SubmitButton>
      <Feedback state={state} />
    </form>
  )
}
