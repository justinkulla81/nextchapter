'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setSeatAccessAction, setSeatAccessEndAction, setSeatSessionsAction } from '@/app/employer/(app)/roster/actions'
import type { RosterSeat } from '@/lib/employer/outplacement-roster'

const day = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')

// Per-person override of what the package unlocks: coaching (and how many
// sessions), the recruiter network, and when access ends.
export function SeatAccessControls({ seat }: { seat: RosterSeat }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [sessions, setSessions] = useState(String(seat.access.coaching?.sessions ?? ''))
  const [ends, setEnds] = useState(day(seat.access.endsAt))
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setErr(null)
      const r = await fn()
      if (r.error) setErr(r.error)
    })
  const c = seat.access.coaching
  const joined = seat.status === 'ACTIVATED'
  const summary = [
    `Coaching ${c?.on ? (c.sessions === null ? 'on' : `${c.sessions} sessions`) : 'off'}`,
    `Recruiters ${seat.access.recruiters ? 'on' : 'off'}`,
  ].join(' · ')

  if (!joined) return <span className="text-xs text-muted-foreground">After they join</span>
  return (
    <details className="text-xs" style={pending ? { cursor: 'wait' } : undefined}>
      <summary className="cursor-pointer whitespace-nowrap text-muted-foreground">{summary}</summary>
      <div className="mt-2 w-64 space-y-3 rounded-md border border-border bg-card p-3">
        <div className="space-y-1">
          <p className="font-medium">Coaching</p>
          <div className="flex gap-1">
            <Button type="button" size="xs" variant={c?.on ? 'default' : 'outline'} disabled={pending} aria-pressed={!!c?.on} onClick={() => run(() => setSeatAccessAction(seat.id, 'coaching', true))}>On</Button>
            <Button type="button" size="xs" variant={!c?.on ? 'default' : 'outline'} disabled={pending} aria-pressed={!c?.on} onClick={() => run(() => setSeatAccessAction(seat.id, 'coaching', false))}>Off</Button>
          </div>
          {c?.on && (
            <div className="flex items-center gap-1">
              <label htmlFor={`s-${seat.id}`}>Sessions</label>
              <Input id={`s-${seat.id}`} type="number" min={0} max={100} value={sessions} onChange={(e) => setSessions(e.target.value)} className="h-7 w-16" />
              <Button type="button" size="xs" variant="outline" disabled={pending || sessions === ''} onClick={() => run(() => setSeatSessionsAction(seat.id, Number(sessions)))}>Save</Button>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="font-medium">Recruiter network</p>
          <div className="flex gap-1">
            <Button type="button" size="xs" variant={seat.access.recruiters ? 'default' : 'outline'} disabled={pending} aria-pressed={!!seat.access.recruiters} onClick={() => run(() => setSeatAccessAction(seat.id, 'recruiters', true))}>On</Button>
            <Button type="button" size="xs" variant={!seat.access.recruiters ? 'default' : 'outline'} disabled={pending} aria-pressed={!seat.access.recruiters} onClick={() => run(() => setSeatAccessAction(seat.id, 'recruiters', false))}>Off</Button>
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor={`e-${seat.id}`} className="font-medium">Access ends</label>
          <div className="flex items-center gap-1">
            <Input id={`e-${seat.id}`} type="date" value={ends} onChange={(e) => setEnds(e.target.value)} className="h-7" />
            <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => run(() => setSeatAccessEndAction(seat.id, ends))}>Save</Button>
          </div>
          <p className="text-muted-foreground">Clear the date to use the contract’s end.</p>
        </div>
        {err && <p className="text-destructive">{err}</p>}
      </div>
    </details>
  )
}
