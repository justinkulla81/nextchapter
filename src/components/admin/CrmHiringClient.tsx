'use client'

import { useState, useTransition } from 'react'
import { setHiringClient } from '@/app/support/admin/(portal)/crm/hiring-client-actions'

/** Two adjacent buttons: is this company a hiring client or not. */
export function CrmHiringClient({ orgId, value }: { orgId: string; value: boolean }) {
  const [current, setCurrent] = useState(value)
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const choose = (next: boolean) => {
    if (next === current) return
    start(async () => {
      const ok = await setHiringClient(orgId, next).catch(() => false)
      if (ok) { setCurrent(next); setError('') }
      else setError('Not saved. Reload the page and try again.')
    })
  }
  const btn = (label: string, on: boolean) => (
    <button
      type="button" disabled={pending} aria-pressed={current === on} onClick={() => choose(on)}
      className={`h-7 px-2 text-xs ${pending ? 'cursor-wait' : ''} ${current === on ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
    >
      {label}
    </button>
  )
  return (
    <div className="mt-3 space-y-1">
      <div role="group" aria-label="Hiring client" className="inline-flex overflow-hidden rounded-md border border-border">
        {btn('Not a hiring client', false)}
        {btn('Hiring client', true)}
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
