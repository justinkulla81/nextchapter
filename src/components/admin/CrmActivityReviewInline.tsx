'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveActivities, discardActivities } from '@/app/support/admin/(portal)/crm/actions'

/**
 * Approve/discard for one outbound email, right where you're already
 * looking at the person — the same actions as the Needs Review queue, for
 * when you're on a record anyway and don't need the full list.
 */
export function CrmActivityReviewInline({ activityId }: { activityId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <span className="ml-2 inline-flex gap-1.5">
      <button
        type="button" disabled={pending}
        onClick={() => start(async () => { await approveActivities([activityId]); router.refresh() })}
        className="rounded border border-border px-1.5 py-0.5 text-xs hover:bg-muted disabled:opacity-60"
      >
        Approve
      </button>
      <button
        type="button" disabled={pending}
        onClick={() => start(async () => { await discardActivities([activityId]); router.refresh() })}
        className="rounded border border-border px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-60"
      >
        Discard
      </button>
    </span>
  )
}
