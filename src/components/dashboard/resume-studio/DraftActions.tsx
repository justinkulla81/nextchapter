'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { createDraft, deleteDraft, duplicateDraft, type StudioActionState } from '@/app/dashboard/resume/studio/actions'

function ErrorText({ state }: { state: StudioActionState }) {
  return state?.error ? (
    <p role="alert" className="text-xs text-destructive">
      {state.error}
    </p>
  ) : null
}

// The one primary action on the drafts page: start from what we already know about you.
export function NewDraftForm({ hasProfileData }: { hasProfileData: boolean }) {
  const [state, action] = useActionState(createDraft, undefined)
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton name="source" value="profile" pendingLabel="Creating…" savedLabel="Start from my profile">
          Start from my profile
        </SubmitButton>
        <SubmitButton name="source" value="blank" variant="outline" pendingLabel="Creating…" savedLabel="Start blank">
          Start blank
        </SubmitButton>
      </div>
      {!hasProfileData && <p className="text-xs text-muted-foreground">Your profile has no work history yet, so a draft started from it will mostly be empty. Upload your resume first, or start blank.</p>}
      <ErrorText state={state} />
    </form>
  )
}

export function DuplicateDraftForm({ draftId, name }: { draftId: string; name: string }) {
  const [state, action] = useActionState(duplicateDraft, undefined)
  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input type="hidden" name="draftId" value={draftId} />
      <SubmitButton size="sm" variant="outline" pendingLabel="Copying…" savedLabel="Duplicate" aria-label={`Duplicate ${name}`}>
        Duplicate
      </SubmitButton>
      <ErrorText state={state} />
    </form>
  )
}

// Deleting is permanent, so it asks first, and the safe choice ("Keep draft") has the focus.
export function DeleteDraftForm({ draftId, name }: { draftId: string; name: string }) {
  const [state, action] = useActionState(deleteDraft, undefined)
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={`Delete ${name}`}>
        Delete
      </Button>
    )
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label={`Confirm deleting ${name}`}>
      <input type="hidden" name="draftId" value={draftId} />
      <span className="text-xs text-foreground">Delete this draft for good?</span>
      <Button type="button" size="sm" autoFocus onClick={() => setConfirming(false)}>
        Keep draft
      </Button>
      <SubmitButton size="sm" variant="destructive" pendingLabel="Deleting…" savedLabel="Delete draft">
        Delete draft
      </SubmitButton>
      <ErrorText state={state} />
    </form>
  )
}
