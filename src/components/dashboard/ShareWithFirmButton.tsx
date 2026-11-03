'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { shareWithFirm } from '@/app/search-firms/interest-actions'

// The member's own click that sends their résumé to a firm that has joined. Busy cursor while it works.
export function ShareWithFirmButton({ orgId, firmName }: { orgId: string; firmName: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        style={pending ? { cursor: 'wait' } : undefined}
        onClick={() => start(async () => {
          setError(null)
          const r = await shareWithFirm(orgId)
          if (!r.ok) return setError(r.error)
          router.refresh()
        })}
        className="inline-flex h-10 items-center rounded-full bg-ink px-6 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-wait"
      >
        {pending ? 'Sending…' : `Send my résumé to ${firmName}`}
      </button>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
