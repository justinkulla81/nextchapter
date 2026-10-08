'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { setPersonDoNotEmail } from '@/app/support/admin/(portal)/crm/mailing/actions'

/**
 * "Do not email, ever" on a CRM record: takes them out of every list send,
 * group and "Add to a mailing list?" card. Turning it on asks first;
 * turning it off is one click.
 */
export function DoNotEmailToggle({ personId, on, hasEmail }: { personId: string; on: boolean; hasEmail: boolean }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const apply = (next: boolean) => start(async () => {
    await setPersonDoNotEmail(personId, next)
    posthog.capture(next ? 'crm_do_not_email_set' : 'crm_do_not_email_cleared', { personId })
    setConfirming(false)
    router.refresh()
  })

  if (on) {
    return (
      <div className={`flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm ${pending ? 'cursor-wait' : ''}`}>
        <span className="font-semibold text-destructive">Do not email, ever</span>
        <span className="text-xs text-muted-foreground">Never on a list send, a group or an &ldquo;Add to a mailing list?&rdquo; card.</span>
        <button type="button" disabled={pending} onClick={() => apply(false)} className="ml-auto rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted">
          {pending ? 'Turning off…' : 'Turn off'}
        </button>
      </div>
    )
  }
  if (!hasEmail) return <p className="text-xs text-muted-foreground">No email address on file, so nothing can be sent to them anyway.</p>
  return confirming ? (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm ${pending ? 'cursor-wait' : ''}`}>
      <span>Never email them from NextChapter lists? They&apos;ll come off every unsent edition too.</span>
      <button type="button" disabled={pending} onClick={() => apply(true)} className="rounded-md border border-destructive/50 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
        {pending ? 'Saving…' : 'Yes, do not email'}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-border px-2.5 py-1 text-xs">Cancel</button>
    </div>
  ) : (
    <button type="button" onClick={() => setConfirming(true)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
      Do not email, ever…
    </button>
  )
}
