'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { setMyConsent } from '@/app/i/[slug]/(portal)/member-actions'

export type ConsentRow = { scope: string; label: string; help: string; granted: boolean }

// Privacy & sharing (spec §5.1): four plain-language switches. Each change is
// a new consent row (history kept); staff views follow it on their next load.
export function PrivacyPanel({ slug, rows }: { slug: string; rows: ConsentRow[] }) {
  const [state, setState] = useState(rows)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle(i: number) {
    const row = state[i]
    const next = !row.granted
    setState((s) => s.map((r, j) => (j === i ? { ...r, granted: next } : r)))
    setError(null)
    start(async () => {
      const r = await setMyConsent(slug, row.scope, next)
      if (r.error) {
        setState((s) => s.map((x, j) => (j === i ? { ...x, granted: row.granted } : x)))
        setError(r.error)
      }
    })
  }

  return (
    <div className={cn('space-y-3', pending && 'cursor-wait')}>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {state.map((r, i) => (
          <li key={r.scope} className="flex items-start gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p id={`c-${r.scope}`} className="text-sm font-medium">
                {r.label}
              </p>
              <p className="text-sm text-muted-foreground">{r.help}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={r.granted}
              aria-labelledby={`c-${r.scope}`}
              onClick={() => toggle(i)}
              className={cn(
                'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                r.granted ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', r.granted ? 'translate-x-5' : 'translate-x-0')} />
              <span className="sr-only">{r.granted ? 'Shared' : 'Not shared'}</span>
            </button>
            <span className="mt-1 w-20 shrink-0 text-xs font-medium text-muted-foreground" aria-hidden="true">
              {r.granted ? 'Shared' : 'Not shared'}
            </span>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
