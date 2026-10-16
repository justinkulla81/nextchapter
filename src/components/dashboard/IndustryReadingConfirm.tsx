'use client'

import { useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { confirmIndustryBuckets } from '@/app/dashboard/search-strategy/industry-actions'

/**
 * "We read 'Venture capital / AI startups' as …": when a member's industry text reads as
 * several industries (or none we know), they confirm with one click. Their jobs, emails
 * and market size then use exactly these.
 */
export function IndustryReadingConfirm({ text, suggested, options }: { text: string; suggested: string[]; options: string[] }) {
  const [picked, setPicked] = useState<string[]>(suggested)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const toggle = (b: string) => setPicked((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b]))

  function confirm() {
    setError(null)
    startTransition(async () => {
      const r = await confirmIndustryBuckets(picked).catch(() => null)
      if (!r?.ok) {
        setError('Pick at least one industry, then confirm.')
        return
      }
      posthog.capture('industry_reading_confirmed', { buckets: picked, changed: picked.join('|') !== suggested.join('|') })
      setDone(true)
    })
  }

  if (done) return <p className="text-sm text-success" role="status">Saved — your jobs and market size now use {picked.join(' and ')}.</p>
  const extra = options.filter((o) => !suggested.includes(o))
  return (
    <div className={cn('space-y-2 rounded-lg border border-border bg-card p-4 text-sm', pending && 'cursor-wait')}>
      <p className="font-medium text-foreground">Which industries do you mean by “{text}”?</p>
      <p className="text-muted-foreground">We use these to pick your jobs and size your market. Keep what fits, add what&apos;s missing.</p>
      <div role="group" aria-label="Industries" className="flex flex-wrap gap-2">
        {suggested.map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={picked.includes(b)}
            onClick={() => toggle(b)}
            className={cn('rounded-full border px-3 py-1', picked.includes(b) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground')}
          >
            {b}
          </button>
        ))}
        <select
          aria-label="Add another industry"
          value=""
          onChange={(e) => e.target.value && setPicked((p) => (p.includes(e.target.value) ? p : [...p, e.target.value]))}
          className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
        >
          <option value="">Add another…</option>
          {extra.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {picked.filter((p) => !suggested.includes(p)).length > 0 && <p className="text-muted-foreground">Also: {picked.filter((p) => !suggested.includes(p)).join(', ')}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button size="sm" onClick={confirm} disabled={pending} aria-busy={pending}>
        {picked.length > 0 ? `Use ${picked.join(' and ')}` : 'Confirm'}
      </Button>
    </div>
  )
}
