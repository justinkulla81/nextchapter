'use client'

import { useState, useTransition } from 'react'
import { sendOutreachEmail } from '@/app/support/admin/(portal)/crm/actions'

/**
 * Plain-text compose, not rich text — sidesteps sanitizing arbitrary pasted
 * HTML entirely for a first version. Any bare URL in the message gets
 * rewritten to a tracked redirect on send; a 1x1 pixel records opens where
 * the recipient's mail client doesn't block remote images.
 */
export function CrmOutreachCompose({ personId, personEmail, personName }: { personId: string; personEmail: string | null; personName: string }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ sent: boolean; message: string } | null>(null)

  if (!personEmail) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No email on file for {personName} — add one above to send outreach.
      </p>
    )
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!window.confirm(`Send this email to ${personName} (${personEmail}) now?`)) return
        start(async () => {
          const r = await sendOutreachEmail(personId, subject, body)
          setResult(r)
          if (r.sent) { setSubject(''); setBody('') }
        })
      }}
    >
      <div>
        <label htmlFor="outreach-subject" className="sr-only">Subject</label>
        <input
          id="outreach-subject" type="text" required placeholder="Subject" value={subject}
          onChange={(e) => setSubject(e.target.value)} disabled={pending}
          className="w-full rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
        />
      </div>
      <div>
        <label htmlFor="outreach-body" className="sr-only">Message to {personName}</label>
        <textarea
          id="outreach-body" required rows={6} placeholder={`Message to ${personEmail}…`} value={body}
          onChange={(e) => setBody(e.target.value)} disabled={pending}
          className="w-full rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={`rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white ${pending ? 'cursor-progress opacity-60' : ''}`}
        >
          {pending ? 'Sending…' : 'Send'}
        </button>
        {result && (
          <span className={`text-xs ${result.sent ? 'text-success' : 'text-destructive'}`}>{result.message}</span>
        )}
      </div>
    </form>
  )
}
