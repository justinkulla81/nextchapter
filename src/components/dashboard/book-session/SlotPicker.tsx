'use client'

import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { posthog } from '@/lib/posthog/client'
import { bookSession } from '@/app/dashboard/book-session/actions'

const noopSubscribe = () => () => {}
// False while rendering on the server and during hydration, true in the browser after: the viewer's
// time zone is only known there, so anything that depends on it waits for this.
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

const selectClass =
  'mt-1 h-10 w-full max-w-sm rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand'

// Day and time are two dropdowns (there are more than four of each), shown in the viewer's own
// time zone. Slots arrive as UTC instants and are grouped here, in the browser, because only the
// browser knows the viewer's zone.
export function SlotPicker({ slots, coachId, coachName }: { slots: string[]; coachId: string; coachName: string }) {
  const [state, action] = useActionState(bookSession, undefined)
  const mounted = useIsClient()
  const [day, setDay] = useState('')
  const [startsAt, setStartsAt] = useState('')

  const days = useMemo(() => {
    if (!mounted) return []
    const byDay = new Map<string, { label: string; times: { iso: string; label: string }[] }>()
    for (const iso of slots) {
      const d = new Date(iso)
      const key = d.toLocaleDateString('en-CA') // yyyy-mm-dd in the viewer's zone
      const entry = byDay.get(key) ?? { label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), times: [] }
      entry.times.push({ iso, label: d.toLocaleTimeString('en-US', { timeStyle: 'short' }) })
      byDay.set(key, entry)
    }
    return [...byDay.entries()].map(([key, v]) => ({ key, ...v }))
  }, [mounted, slots])

  useEffect(() => {
    if (mounted) posthog.capture('coach_slots_viewed', { coachId, slotCount: slots.length })
  }, [mounted, coachId, slots.length])

  const times = days.find((d) => d.key === day)?.times ?? []
  // After a booking the slot list refreshes and the time just taken disappears; a stale choice must not stay selected.
  const chosen = times.some((t) => t.iso === startsAt) ? startsAt : ''
  const zone = mounted ? new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value : null

  if (!mounted) return <p className="text-sm text-muted-foreground">Loading times in your time zone…</p>

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="startsAt" value={chosen} />
      <div>
        <Label>
          <span className="text-sm font-medium text-foreground">Day</span>
          <select
            className={selectClass}
            value={day}
            onChange={(e) => {
              setDay(e.target.value)
              setStartsAt('')
            }}
          >
            <option value="">Choose a day</option>
            {days.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label} ({d.times.length} {d.times.length === 1 ? 'time' : 'times'})
              </option>
            ))}
          </select>
        </Label>
      </div>
      <div>
        <Label>
          <span className="text-sm font-medium text-foreground">Time</span>
          <select className={selectClass} value={chosen} onChange={(e) => setStartsAt(e.target.value)} disabled={times.length === 0}>
            <option value="">{times.length === 0 ? 'Choose a day first' : 'Choose a time'}</option>
            {times.map((t) => (
              <option key={t.iso} value={t.iso}>
                {t.label}
              </option>
            ))}
          </select>
        </Label>
        {times.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Times appear once you pick a day.</p>}
      </div>
      {zone && <p className="text-xs text-muted-foreground">Times are shown in your time zone: {zone}.</p>}
      <SubmitButton pendingLabel="Booking…" savedLabel={`Book with ${coachName.split(' ')[0]}`} disabled={!chosen}>
        {`Book with ${coachName.split(' ')[0]}`}
      </SubmitButton>
      {!chosen && <p className="text-xs text-muted-foreground">Choose a day and a time to turn on the Book button.</p>}
      {state?.message && (
        <p role="status" className="text-sm text-foreground">
          {state.message}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}
