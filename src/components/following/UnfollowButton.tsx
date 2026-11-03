'use client'

import { useState, useTransition } from 'react'
import { setCompanyWatched } from '@/app/dashboard/find-my-job/my-jobs-actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const LINK = 'text-sm font-medium text-brand underline underline-offset-4'

/** Unfollow in two steps, so a stray click never removes a company. The safe choice (Cancel) is the first control. */
export function UnfollowButton({ company, entryId }: { company: string; entryId: string }) {
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!asking) {
    return <button type="button" onClick={() => setAsking(true)} className={LINK}>Unfollow</button>
  }
  return (
    <span className={cn('flex flex-wrap items-center gap-3', pending && 'cursor-wait')}>
      <button type="button" autoFocus disabled={pending} onClick={() => { setAsking(false); setError(null) }} className={LINK}>Keep following</button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            posthog.capture('company_unfollowed', { company, entryId, source: 'following_page' })
            const r = await setCompanyWatched(company, false)
            if (!r.ok) setError(r.error)
          })
        }
        className="text-sm font-medium text-destructive underline underline-offset-4"
      >
        {pending ? 'Removing…' : `Unfollow ${company}`}
      </button>
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </span>
  )
}
