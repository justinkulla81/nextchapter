'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { expressInterest, withdrawInterest, type InterestSource } from '@/app/search-firms/interest-actions'
import { cn } from '@/lib/utils'
import { readableOn } from '@/lib/recruiter/brand'

// The one button for a firm. Pressing it records the interest and, if the member has no résumé yet, goes straight to
// adding one. Pressing it again on a firm they already picked withdraws it. Busy cursor while it works (design-principles.md).
export function ExpressInterestButton({
  orgId,
  firmName,
  source,
  initiallyInterested = false,
  primary = false,
  accent = null,
  className,
  onDone,
}: {
  orgId: string
  firmName: string
  source: InterestSource
  initiallyInterested?: boolean
  primary?: boolean
  /** The firm's accent color for the primary button; null keeps NextChapter's navy. */
  accent?: string | null
  className?: string
  /** Called after a successful press that stays on the page, so the page can show where the member now stands. */
  onDone?: () => void
}) {
  const router = useRouter()
  const [interested, setInterested] = useState(initiallyInterested)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const press = () =>
    start(async () => {
      setError(null)
      const r = interested ? await withdrawInterest(orgId) : await expressInterest(orgId, source)
      if (!r.ok) return setError(r.error)
      setInterested(r.interested)
      if (r.next) router.push(r.next)
      else onDone?.()
    })

  const base = 'inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait'
  const look = interested
    ? 'border-success text-success hover:bg-success/5'
    : primary
      ? 'border-navy bg-navy text-white hover:opacity-90'
      : 'border-navy text-navy hover:bg-navy/5'
  return (
    <span className={cn('inline-flex flex-col items-start gap-1', className)}>
      <button
        type="button"
        onClick={press}
        disabled={pending}
        aria-pressed={interested}
        className={cn(base, look, pending && 'cursor-wait')}
        style={{ ...(primary && accent && !interested ? { backgroundColor: accent, borderColor: accent, color: readableOn(accent) } : {}), ...(pending ? { cursor: 'wait' } : {}) }}
      >
        {pending ? 'Saving…' : interested ? `Interested in ${firmName}` : `Express interest${primary ? ` in ${firmName}` : ''}`}
      </button>
      {interested && !pending && <span className="text-xs text-muted-foreground">Select again to withdraw.</span>}
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
