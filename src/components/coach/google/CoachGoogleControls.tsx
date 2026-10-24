'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { posthog } from '@/lib/posthog/client'
import { usePreservedFormAction } from '@/lib/forms/use-preserved-form'
import { addConflictCalendar, disconnectCoachGoogleCalendar, removeConflictCalendar } from '@/app/support/coach/(app)/booking/actions'

// A plain link to the start route, not next/link: the route mints a signed state and sends the browser to Google,
// so it must only run when the coach clicks, never on a prefetch.
export function GoogleConnectLink({ label, reconnect = false, className }: { label: string; reconnect?: boolean; className?: string }) {
  return (
    <a
      href="/support/coach/google/start"
      onClick={() => posthog.capture(reconnect ? 'coach_google_reconnect_clicked' : 'coach_google_connect_clicked')}
      className={className ?? 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95'}
    >
      {label}
    </a>
  )
}

/** Shown while the feature is off: the button is there, and says why it does nothing yet. */
export function GoogleConnectUnavailable() {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" aria-disabled="true" aria-describedby="google-off-why" className="inline-flex h-11 cursor-not-allowed items-center rounded-full bg-muted px-7 text-base font-semibold text-muted-foreground">
        Connect Google Calendar
      </button>
      <p id="google-off-why" className="max-w-md text-sm text-muted-foreground">
        Not available yet. Until it is, your sessions go on the shared NextChapter calendar with a Meet link, as they do now. Nothing to do on your side.
      </p>
    </div>
  )
}

// Disconnecting pauses new bookings, so it asks first and the safe choice (stay connected) has the focus.
export function DisconnectGoogleForm() {
  const [state, action] = useActionState(disconnectCoachGoogleCalendar, undefined)
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)}>
        Disconnect
      </Button>
    )
  }
  return (
    <form action={action} onSubmit={() => posthog.capture('coach_google_disconnect_confirmed')} className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label="Confirm disconnecting Google Calendar">
      <span className="text-xs text-foreground">New bookings pause until you connect again. Booked sessions keep their Meet links.</span>
      <Button type="button" size="sm" autoFocus onClick={() => setConfirming(false)}>
        Stay connected
      </Button>
      <SubmitButton size="sm" variant="destructive" pendingLabel="Disconnecting…" savedLabel="Disconnect">
        Disconnect
      </SubmitButton>
      {state?.error && (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      )}
    </form>
  )
}

function RemoveCalendar({ id }: { id: string }) {
  const [state, action] = useActionState(removeConflictCalendar, undefined)
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="calendarId" value={id} />
      <SubmitButton size="sm" variant="ghost" pendingLabel="Removing…" savedLabel="Remove" aria-label={`Stop checking ${id === 'primary' ? 'your main calendar' : id}`}>
        Remove
      </SubmitButton>
      {state?.error && (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      )}
    </form>
  )
}

export function ConflictCalendars({ calendarIds, email }: { calendarIds: string[]; email: string }) {
  // Submitted without React's form reset, so a rejected address stays in the box to be fixed.
  const { state, pending, onSubmit } = usePreservedFormAction(addConflictCalendar, { resetOnSuccess: true })
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ink">Check these calendars for conflicts</p>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {calendarIds.map((id, i) => (
          <li key={id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-sm text-ink">
              {id === 'primary' ? `Your main calendar (${email})` : id}
              {i === 0 && <span className="ml-2 text-xs text-muted-foreground">Sessions are added here</span>}
            </span>
            {calendarIds.length > 1 && <RemoveCalendar id={id} />}
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit} className={`flex flex-wrap items-end gap-2${pending ? ' cursor-progress' : ''}`}>
        <div>
          <Label htmlFor="calendarId" className="text-sm font-medium text-foreground">
            Add another calendar
          </Label>
          <Input id="calendarId" name="calendarId" type="text" placeholder="family@group.calendar.google.com" className="mt-1 w-72 max-w-full" required />
        </div>
        <SubmitButton size="sm" pendingLabel="Checking…" savedLabel="Add calendar">
          Add calendar
        </SubmitButton>
      </form>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="text-sm text-foreground">
          {state.message}
        </p>
      )}
      <p className="text-sm text-muted-foreground">Why: a session is only offered when none of these show you as busy. Google gives us busy or free only, never titles or guests, so we ask for each calendar by its address.</p>
    </div>
  )
}
