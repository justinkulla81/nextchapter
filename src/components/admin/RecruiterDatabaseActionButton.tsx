'use client'

import { useState, useTransition } from 'react'
import { notifyRecruitersForCandidate, nudgeCandidateToUnlock } from '@/app/support/admin/(portal)/recruiter-database/actions'

export function RecruiterDatabaseActionButton({
  candidateId,
  action,
}: {
  candidateId: string
  action: 'notify' | 'nudge'
}) {
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (done) {
    return <span className="text-xs font-medium text-success">Sent ✓</span>
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          if (action === 'notify') await notifyRecruitersForCandidate(candidateId)
          else await nudgeCandidateToUnlock(candidateId)
          setDone(true)
        })
      }
      className="rounded-md border border-input px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
    >
      {isPending ? 'Sending…' : action === 'notify' ? 'Notify recruiters' : 'Nudge to unlock'}
    </button>
  )
}
