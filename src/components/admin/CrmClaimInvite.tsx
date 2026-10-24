'use client'

import { useState, useTransition } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { Button } from '@/components/ui/button'
import { sendOutreachEmail, setCandidateInvited } from '@/app/support/admin/(portal)/crm/actions'

/**
 * Send one person a link to claim a NextChapter profile. The email is editable
 * and goes out through the normal CRM compose path (tracked, stop list honoured,
 * from the company address); for someone with no email, copy the LinkedIn text.
 * Either way they are marked invited, so their sign-up is matched back to this record.
 */
export function CrmClaimInvite({
  personId, email, subject, emailBody, linkedinText, invitedAt,
}: {
  personId: string
  email: string | null
  subject: string
  emailBody: string
  linkedinText: string
  invitedAt: string | null
}) {
  const posthog = usePostHog()
  const [body, setBody] = useState(emailBody)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const sendEmail = () => start(async () => {
    const r = await sendOutreachEmail(personId, subject, body)
    setMessage(r.message)
    if (r.sent) {
      await setCandidateInvited(personId, true)
      posthog?.capture('claim_link_sent', { personId, channel: 'email' })
    }
  })

  const copyLinkedIn = () => start(async () => {
    try {
      await navigator.clipboard.writeText(linkedinText)
      await setCandidateInvited(personId, true)
      posthog?.capture('claim_link_sent', { personId, channel: 'linkedin_copy' })
      setMessage('Copied. Paste it into a LinkedIn message.')
    } catch {
      setMessage('Could not copy automatically. Select the text below and copy it by hand.')
    }
  })

  return (
    <div className={`space-y-4 ${pending ? 'cursor-wait' : ''}`}>
      <p className="text-sm text-muted-foreground">
        A private link to a profile pre-filled from what the CRM knows. They say whether they are working or between jobs; no resume.
        {invitedAt && <> Already invited {invitedAt}.</>}
      </p>

      {email ? (
        <div className="space-y-2">
          <label className="block text-xs font-medium" htmlFor={`claim-body-${personId}`}>Email to {email} (editable)</label>
          <textarea
            id={`claim-body-${personId}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
            className="w-full rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
          <Button size="sm" onClick={sendEmail} disabled={pending || !body.trim()}>
            {pending ? 'Sending…' : 'Send claim link'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No email on file, so the LinkedIn message below is the way to reach them.</p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium">LinkedIn message</p>
        <p className="whitespace-pre-line rounded-md bg-muted p-2 text-sm">{linkedinText}</p>
        <Button size="sm" variant="outline" onClick={copyLinkedIn} disabled={pending}>Copy LinkedIn message</Button>
      </div>

      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  )
}
