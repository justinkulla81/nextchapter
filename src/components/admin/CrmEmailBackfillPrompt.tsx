'use client'

import { useState, useTransition } from 'react'
import { setPersonEmailAndCheckCorrespondence } from '@/app/support/admin/(portal)/crm/actions'

/**
 * "Do you have their email?" — shown only when the person has none on file.
 * Saving triggers a one-time Gmail correspondence check for that address (see
 * backfillPersonFromEmail's own comment for why this differs from the
 * nightly sweep), so the result message reports what that search found
 * rather than just confirming the save.
 */
export function CrmEmailBackfillPrompt({ personId, email }: { personId: string; email: string | null }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedEmail, setSavedEmail] = useState(email)

  if (savedEmail) {
    return <a href={`mailto:${savedEmail}`} className="text-muted-foreground underline underline-offset-2">{savedEmail}</a>
  }

  const submit = (formData: FormData) => {
    setResult(null)
    start(async () => {
      const res = await setPersonEmailAndCheckCorrespondence(personId, formData)
      setResult(res)
      if (res.ok) setSavedEmail(String(formData.get('email') ?? '').trim())
    })
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <form action={submit} className="inline-flex items-center gap-1">
        <input
          type="email"
          name="email"
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
      </form>
      {result && !result.ok && <span className="text-xs text-destructive">{result.message}</span>}
      {result?.ok && <span className="text-xs text-success">{result.message}</span>}
    </span>
  )
}
