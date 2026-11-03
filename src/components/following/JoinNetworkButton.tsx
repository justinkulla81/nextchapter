'use client'

import { useState, useTransition } from 'react'
import { joinNetwork } from '@/app/dashboard/following/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

export function JoinNetworkButton({ kind, refId, name }: { kind: 'SCHOOL' | 'FORMER_EMPLOYER'; refId: string; name: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className={cn('flex flex-col items-start gap-1 sm:items-end', pending && 'cursor-wait')}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null)
            posthog.capture('alumni_network_join_clicked', { kind, refId, source: 'following_page' })
            const r = await joinNetwork(kind, refId)
            if (!r.ok) setError(r.error ?? 'We could not save that. Try again in a moment.')
          })
        }
        className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-70"
      >
        {pending ? 'Joining…' : `Join ${name}`}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
