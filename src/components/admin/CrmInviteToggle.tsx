'use client'

import { useState, useTransition } from 'react'
import { setCandidateInvited } from '@/app/support/admin/(portal)/crm/actions'

/**
 * "I invited them to join NextChapter." When someone with a similar name or
 * the same email signs up, it's flagged on Identity Matches so the admin can
 * connect the two and credit the referral as the candidate's lead source.
 */
export function CrmInviteToggle({
  personId, invitedAt, isCandidate,
}: {
  personId: string
  invitedAt: string | null
  isCandidate: boolean
}) {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  if (isCandidate) {
    return (
      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand">
        NextChapter candidate{invitedAt ? ` · invited ${invitedAt}` : ''}
      </span>
    )
  }

  const invited = invitedAt !== null
  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        aria-pressed={invited}
        onClick={() => start(async () => setMessage((await setCandidateInvited(personId, !invited)).message))}
        className={`rounded-md border px-2 py-1 ${invited ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-border hover:bg-muted'} ${pending ? 'cursor-progress opacity-60' : ''}`}
      >
        {invited ? `Invited to NextChapter · ${invitedAt}` : 'Mark invited to NextChapter'}
      </button>
      {message && <span className="text-muted-foreground">{message}</span>}
    </span>
  )
}
