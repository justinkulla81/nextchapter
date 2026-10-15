'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { usePreservedFormAction } from '@/lib/forms/use-preserved-form'
import { saveBookingSettings } from '@/app/support/coach/(app)/booking/actions'
import { END_OPTIONS, formatMinute, START_OPTIONS } from '@/lib/coach/booking/format'
import { SLOT_MINUTE_CHOICES, WEEKDAY_LABELS, type AvailabilityWindow } from '@/lib/coach/booking/slots'
import type { CoachBookingConfig } from '@/lib/coach/booking/service'

const selectClass = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand'

// Monday first reads more naturally for working hours; the stored weekday is still 0 = Sunday.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function BookingSettingsForm({ config, windows, timeZones }: { config: CoachBookingConfig; windows: AvailabilityWindow[]; timeZones: string[] }) {
  // Submitted without React's form reset: a rejected save (an end time before a start time, say) keeps every edit.
  const { state, pending, onSubmit } = usePreservedFormAction(saveBookingSettings)
  const [slotMinutes, setSlotMinutes] = useState(config.slotMinutes)
  const byDay = new Map(windows.map((w) => [w.weekday, w]))
  const [open, setOpen] = useState<Record<number, boolean>>(() => Object.fromEntries(DISPLAY_ORDER.map((d) => [d, byDay.has(d)])))

  return (
    <form onSubmit={onSubmit} className={cn('space-y-6', pending && 'cursor-progress')}>
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input type="checkbox" name="enabled" defaultChecked={config.enabled} className="size-4" />
        Let my clients book sessions
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Weekly hours</legend>
        <p className="text-xs text-muted-foreground">Clients can book sessions that fit inside these hours. Tick the days you take sessions.</p>
        <ul className="space-y-2">
          {DISPLAY_ORDER.map((weekday) => {
            const w = byDay.get(weekday)
            return (
              <li key={weekday} className="flex flex-wrap items-center gap-3">
                <label className="flex w-36 items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" name={`day-${weekday}`} checked={open[weekday]} onChange={(e) => setOpen((o) => ({ ...o, [weekday]: e.target.checked }))} className="size-4" />
                  {WEEKDAY_LABELS[weekday]}
                </label>
                <select name={`start-${weekday}`} aria-label={`${WEEKDAY_LABELS[weekday]} start time`} defaultValue={w?.startMinute ?? 9 * 60} disabled={!open[weekday]} className={cn(selectClass, !open[weekday] && 'opacity-50')}>
                  {START_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {formatMinute(m)}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-muted-foreground">to</span>
                <select name={`end-${weekday}`} aria-label={`${WEEKDAY_LABELS[weekday]} end time`} defaultValue={w?.endMinute ?? 17 * 60} disabled={!open[weekday]} className={cn(selectClass, !open[weekday] && 'opacity-50')}>
                  {END_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {formatMinute(m)}
                    </option>
                  ))}
                </select>
                {!open[weekday] && <span className="text-xs text-muted-foreground">Not taking sessions</span>}
              </li>
            )
          })}
        </ul>
      </fieldset>

      <div className="space-y-1">
        <Label>
          <span className="text-sm font-medium text-foreground">Your time zone</span>
          <Input name="timezone" list="booking-timezones" defaultValue={config.timezone} required className="mt-1 max-w-sm" autoComplete="off" />
        </Label>
        <datalist id="booking-timezones">
          {timeZones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground">Start typing a city, such as “America/Chicago”. Your hours above are in this time zone. Clients see times in theirs.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Session length</p>
        <input type="hidden" name="slotMinutes" value={slotMinutes} />
        <div role="group" aria-label="Session length" className="flex gap-2">
          {SLOT_MINUTE_CHOICES.map((m) => (
            <Button key={m} type="button" size="sm" variant={slotMinutes === m ? 'default' : 'outline'} aria-pressed={slotMinutes === m} onClick={() => setSlotMinutes(m)}>
              {m} minutes
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Label className="space-y-1">
          <span className="text-sm font-medium text-foreground">Minutes between sessions</span>
          <Input type="number" name="bufferMinutes" min={0} max={120} step={5} defaultValue={config.bufferMinutes} required />
        </Label>
        <Label className="space-y-1">
          <span className="text-sm font-medium text-foreground">Minimum notice, in hours</span>
          <Input type="number" name="minNoticeHours" min={0} max={336} defaultValue={config.minNoticeHours} required />
        </Label>
        <Label className="space-y-1">
          <span className="text-sm font-medium text-foreground">Book up to this many days ahead</span>
          <Input type="number" name="maxDaysAhead" min={1} max={90} defaultValue={config.maxDaysAhead} required />
        </Label>
      </div>

      <Label className="block space-y-1">
        <span className="text-sm font-medium text-foreground">Your own meeting link (optional)</span>
        <Input type="url" name="fallbackMeetingUrl" defaultValue={config.fallbackMeetingUrl ?? ''} placeholder="https://" className="max-w-md" />
        <span className="block text-xs text-muted-foreground">We make a Google Meet link for each session when we can. This is the link clients get if we cannot.</span>
      </Label>

      <Button type="submit" disabled={pending} className={cn(pending && 'cursor-progress')}>
        {pending ? 'Saving…' : 'Save booking settings'}
      </Button>
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
