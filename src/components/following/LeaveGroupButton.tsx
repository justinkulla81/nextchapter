'use client'

import { useState, useTransition } from 'react'
import { leaveGroup } from '@/app/dashboard/following/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const LINK = 'text-sm font-medium text-brand underline underline-offset-4'

/** Leave a group in two steps. The copy says whether you can come back, so nobody leaves by accident. */
export function LeaveGroupButton({ communityId, label, canRejoin }: { communityId: string; label: string; canRejoin: boolean }) {
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!asking) return <button type="button" onClick={() => setAsking(true)} className={LINK}>Leave</button>
  return (
    <span className={cn('flex flex-wrap items-center gap-3', pending && 'cursor-wait')}>
      <span className="text-sm text-muted-foreground">{canRejoin ? 'You can rejoin any time.' : 'You will not be added again.'}</span>
      <button type="button" autoFocus disabled={pending} onClick={() => { setAsking(false); setError(null) }} className={LINK}>Stay in {label}</button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            posthog.capture('group_leave_confirmed', { communityId, source: 'following_page' })
            const r = await leaveGroup(communityId)
            if (!r.ok) setError(r.error ?? 'We could not save that. Try again in a moment.')
          })
        }
        className="text-sm font-medium text-destructive underline underline-offset-4"
      >
        {pending ? 'Leaving…' : 'Leave group'}
      </button>
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </span>
  )
}
