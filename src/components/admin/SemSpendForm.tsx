'use client'

import { useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { PAID_CHANNELS, paidChannelLabel, type PaidChannel } from '@/lib/admin/paid-channels'
import { saveSemSpend, type SaveSpendResult } from '@/app/support/admin/(portal)/visitors/activity/actions'

const SEGMENTS = [
  { key: 'b2c', label: 'B2C' },
  { key: 'b2b', label: 'B2B' },
] as const

// One day's spend on one ad channel for one segment. The inputs stay filled after a failed save.
export function SemSpendForm({ today, windowStart }: { today: string; windowStart: string }) {
  const [day, setDay] = useState(today)
  const [channel, setChannel] = useState<PaidChannel>('google')
  const [segment, setSegment] = useState<'b2c' | 'b2b'>('b2c')
  const [dollars, setDollars] = useState('')
  const [pending, start] = useTransition()
  const [result, setResult] = useState<SaveSpendResult | null>(null)

  return (
    <form
      className="mt-3 space-y-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await saveSemSpend({ day, channel, segment, dollars })
          setResult(r)
          if (r.ok) {
            setDollars('')
            posthog.capture('sem_spend_saved', { day: r.day, channel: r.channel, segment: r.segment, dollars: r.dollars })
          }
        })
      }}
      style={pending ? { cursor: 'wait' } : undefined}
    >
      <p className="text-xs font-medium text-foreground">Add a day&apos;s ad spend</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Date
          <input
            type="date"
            value={day}
            min={windowStart}
            max={today}
            onChange={(e) => setDay(e.target.value)}
            className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            required
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Channel
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as PaidChannel)}
            className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {PAID_CHANNELS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Segment" className="flex overflow-hidden rounded-md border border-border text-sm">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={segment === s.key}
              onClick={() => setSegment(s.key)}
              className={`px-3 py-1.5 ${segment === s.key ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="text-xs text-muted-foreground">
          Spent ($)
          <input
            type="text"
            inputMode="decimal"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
            placeholder="42.50"
            className="mt-1 block w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            required
          />
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-action px-5 py-2 text-sm font-semibold text-action-foreground disabled:opacity-60">
          {pending ? 'Saving…' : 'Save spend'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Saving the same date, channel and segment again replaces that day&apos;s number.</p>
      {result?.ok && (
        <p role="status" className="text-sm text-success">
          Saved ${result.dollars.toFixed(2)} for {paidChannelLabel(result.channel)} {result.segment.toUpperCase()} on {result.day}.
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-sm text-destructive">
          {result.message}
        </p>
      )}
    </form>
  )
}
