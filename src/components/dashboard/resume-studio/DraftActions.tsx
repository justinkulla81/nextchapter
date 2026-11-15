'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { posthog } from '@/lib/posthog/client'
import { createDraft, deleteDraft, duplicateDraft, makeVersion, type StudioActionState } from '@/app/dashboard/resume/studio/actions'
import { importFromUpload } from '@/app/dashboard/resume/studio/import-actions'
import { VERSION_KINDS, type DraftKind } from '@/lib/resume/studio/versions'

function ErrorText({ state }: { state: StudioActionState }) {
  return state?.error ? (
    <p role="alert" className="text-xs text-destructive">
      {state.error}
    </p>
  ) : null
}

// The one primary action on the drafts page: start from what we already know about you.
export function NewDraftForm({ hasProfileData, hasUpload = false }: { hasProfileData: boolean; hasUpload?: boolean }) {
  const [state, action] = useActionState(createDraft, undefined)
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* With an upload on file, importing it is the one primary action; starting from the profile steps back. */}
        <SubmitButton name="source" value="profile" variant={hasUpload ? 'outline' : 'default'} pendingLabel="Creating…" savedLabel="Start from my profile">
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

// The one primary action when a resume has been uploaded and not yet brought in: read it into the studio exactly
// as written, as the Original. Reading takes a while, so the button says so while it works.
export function ImportUploadForm({ resumeId, fileName, again = false }: { resumeId: string; fileName: string; again?: boolean }) {
  const [state, action] = useActionState(importFromUpload, undefined)
  return (
    <form action={action} className="space-y-2" onSubmit={() => posthog.capture('resume_import_started', { resumeId, again })}>
      <input type="hidden" name="resumeId" value={resumeId} />
      {again && <input type="hidden" name="again" value="1" />}
      <SubmitButton pendingLabel="Reading your resume… this takes up to a minute" savedLabel={again ? 'Read it again' : 'Import my uploaded resume'}>
        {again ? 'Read it again' : 'Import my uploaded resume'}
      </SubmitButton>
      <p className="text-xs text-muted-foreground">
        Brings in {fileName} word for word, with every bullet, date and section, as your Original. We check the result against your file and tell you if anything did not come across.
      </p>
      <ErrorText state={state} />
    </form>
  )
}

// A labelled version of a draft: pick what it is for, name the function, industry, company or job, and it opens ready
// to edit. The draft it was copied from, usually the Original, stays exactly as it was.
export function MakeVersionForm({ fromDraftId, fromName, primary = false }: { fromDraftId: string; fromName: string; primary?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Exclude<DraftKind, 'ORIGINAL' | 'GENERAL'>>('FUNCTION')
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const chosen = VERSION_KINDS.find((k) => k.kind === kind) ?? VERSION_KINDS[0]

  if (!open) {
    return (
      <Button type="button" size="sm" variant={primary ? 'default' : 'outline'} onClick={() => setOpen(true)} aria-label={`Make a version of ${fromName}`}>
        Make a version
      </Button>
    )
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await makeVersion({ fromDraftId, kind, targetLabel: target })
      if (result.ok) {
        posthog.capture('resume_version_created_client', { fromDraftId, kind })
        router.push(`/dashboard/resume/studio/${result.draftId}`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className={cn('w-full space-y-3 rounded-lg border border-border p-4', pending && 'cursor-progress')} role="group" aria-label={`Make a version of ${fromName}`}>
      <p className="text-sm font-medium text-foreground">What is this version for?</p>
      <div role="group" aria-label="Kind of version" className="flex flex-wrap gap-2">
        {VERSION_KINDS.map((k) => (
          <Button key={k.kind} type="button" size="sm" variant={kind === k.kind ? 'default' : 'outline'} aria-pressed={kind === k.kind} onClick={() => setKind(k.kind as typeof kind)}>
            {k.label}
          </Button>
        ))}
      </div>
      <label className="block space-y-1 text-sm">
        <span className="text-foreground">{chosen.targetNoun}</span>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          maxLength={80}
          placeholder={`For example: ${chosen.example}`}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={submit}>
          {pending ? 'Creating…' : 'Create version'}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">{`Copies ${fromName}. The original stays as it is.`}</span>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
