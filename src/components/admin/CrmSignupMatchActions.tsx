'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirmIdentityMatch, rejectIdentityMatch } from '@/app/support/admin/(portal)/identity-matches/actions'

/**
 * Link accounts / Not them for a possible sign-up match — used on the
 * Review List and on a person's CRM record. Linking merges the record the
 * sign-up created into this one.
 */
export function CrmSignupMatchActions({ matchId, onChanged }: { matchId: string; onChanged?: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [done, setDone] = useState<'linked' | 'dismissed' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function act(kind: 'linked' | 'dismissed') {
    setError(null)
    start(async () => {
      try {
        await (kind === 'linked' ? confirmIdentityMatch(matchId) : rejectIdentityMatch(matchId))
        setDone(kind)
        if (onChanged) onChanged(); else router.refresh()
      } catch {
        setError('That didn’t save. Try again.')
      }
    })
  }

  if (done) return <span className="text-xs text-muted-foreground">{done === 'linked' ? 'Linked.' : 'Dismissed.'}</span>
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${pending ? 'cursor-wait' : ''}`}>
      <button
        type="button"
        disabled={pending}
        onClick={() => act('linked')}
        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:cursor-wait"
      >
        {pending ? 'Saving…' : 'Link accounts'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => act('dismissed')}
        className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:cursor-wait"
      >
        Not them
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
