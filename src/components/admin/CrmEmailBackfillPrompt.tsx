'use client'

import { useState, useTransition } from 'react'
import { setPersonEmailAndCheckCorrespondence } from '@/app/support/admin/(portal)/crm/actions'

/**
 * "Do you have their email?" when there's none on file, or a plain
 * click-to-edit link when there is. Either way, saving triggers a one-time
 * Gmail correspondence check for that address (see backfillPersonFromEmail's
 * own comment for why this differs from the nightly sweep), so the result
 * message reports what that search found rather than just confirming the
 * save — genuinely useful on an edit too, since a corrected address is
 * exactly when a fresh check matters most.
 */
export function CrmEmailBackfillPrompt({ personId, email }: { personId: string; email: string | null }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedEmail, setSavedEmail] = useState(email)
  const [editing, setEditing] = useState(false)

  if (savedEmail && !editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <a href={`mailto:${savedEmail}`} className="text-muted-foreground underline underline-offset-2">{savedEmail}</a>
        <button
          type="button"
          onClick={() => { setResult(null); setEditing(true) }}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Edit
        </button>
        {result?.ok && <span className="text-xs text-success">{result.message}</span>}
      </span>
    )
  }

  const submit = (formData: FormData) => {
    setResult(null)
    start(async () => {
      const res = await setPersonEmailAndCheckCorrespondence(personId, formData)
      setResult(res)
      if (res.ok) { setSavedEmail(String(formData.get('email') ?? '').trim()); setEditing(false) }
    })
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {/* Still scannable as "missing" at a glance in a dense list — was a
          plain amber "No email on file" label before this became editable. */}
      {!savedEmail && <span className="text-xs font-medium text-amber-700">No email on file</span>}
      <form action={submit} className="inline-flex items-center gap-1">
        <input
          type="email"
          name="email"
          defaultValue={savedEmail ?? ''}
          disabled={pending}
          placeholder="Do you have their email?"
          aria-label="Their email address"
          className={`h-6 w-40 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
        />
        <button
          type="submit"
          disabled={pending}
          className={`h-6 shrink-0 rounded border border-border px-1.5 text-xs hover:bg-muted ${pending ? 'cursor-progress opacity-60' : ''}`}
        >
          {pending ? 'Checking…' : 'Check'}
        </button>
        {savedEmail && (
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted-foreground underline">
            Cancel
          </button>
        )}
      </form>
      {/* A successful save flips `editing` back to false, which switches to
          the branch above on the next render — its own success message
          covers that case, so only the error needs showing here. */}
      {result && !result.ok && <span className="text-xs text-destructive">{result.message}</span>}
    </span>
  )
}
