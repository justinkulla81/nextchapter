'use client'

import { useActionState, useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { deleteMyGoogleData, type DeleteGoogleDataState } from '@/app/dashboard/privacy/google-data-actions'
import { GOOGLE_DATA_CONFIRM_WORD } from '@/lib/google/google-data-confirm'
import { cn } from '@/lib/utils'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * "Delete my Google data": revokes our Google access and deletes what we
 * stored from Gmail and Calendar. Destructive, so it opens a confirmation
 * step first (type DELETE), and "Keep my Google data" is the first button.
 */
export function DeleteGoogleDataForm({ hasGoogleData }: { hasGoogleData: boolean }) {
  const posthog = usePostHog()
  const [expanded, setExpanded] = useState(false)
  const [typed, setTyped] = useState('')
  const [state, formAction, pending] = useActionState<DeleteGoogleDataState, FormData>(async (prev, formData) => {
    posthog?.capture('google_data_delete_requested', { from: 'privacy' })
    return deleteMyGoogleData(prev, formData)
  }, undefined)

  if (state?.ok) {
    const r = state.result
    const parts = [
      plural(r.emails, 'email record', 'email records'),
      plural(r.calendarEvents, 'calendar event', 'calendar events'),
      plural(r.scamAlerts, 'scam alert', 'scam alerts'),
      plural(r.platformEmails, 'platform email', 'platform emails'),
    ]
    return (
      <div role="status" className="max-w-xl space-y-2 text-base text-ink">
        <p className="font-semibold">Your Google data is deleted.</p>
        <p>
          We deleted {parts.join(', ')}, and your stored Google sign-in.{' '}
          {r.grantRevoked
            ? 'NextChapter no longer has access to your Google account.'
            : r.hadTokens
              ? 'Google did not confirm that our access was removed. To be sure, remove NextChapter at myaccount.google.com/connections.'
              : 'NextChapter had no access to your Google account to remove.'}
        </p>
        <p className="text-sm text-muted-foreground">Your applications, contacts and points stay. You can connect Google again any time.</p>
      </div>
    )
  }

  if (!expanded) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex h-10 items-center rounded-full border border-destructive px-5 text-sm font-medium text-destructive hover:bg-destructive/5"
        >
          Delete my Google data
        </button>
        {!hasGoogleData && <p className="text-sm text-muted-foreground">We have no Gmail or Calendar data for you right now, so there is nothing to delete.</p>}
      </div>
    )
  }

  return (
    <form action={formAction} className={cn('max-w-xl space-y-3', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <p className="text-base text-ink">
        This disconnects Gmail and Calendar, removes NextChapter&apos;s access in your Google account, and permanently deletes
        what we stored from them: email subjects, senders, dates and message IDs, calendar event titles, times and attendees,
        and your scam alerts. It cannot be undone.
      </p>
      <p className="text-sm text-muted-foreground">
        Kept: your applications, contacts, the platforms you use, and points you already earned. They stay as your own records,
        with no link to any email or event.
      </p>
      <div className="space-y-1">
        <label htmlFor="google-data-confirmation" className="text-sm font-medium text-ink">
          Type {GOOGLE_DATA_CONFIRM_WORD} to confirm
        </label>
        <input
          id="google-data-confirmation"
          name="confirmation"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={GOOGLE_DATA_CONFIRM_WORD}
          autoComplete="off"
          required
          className="block h-10 w-48 rounded-md border border-border bg-white px-3 text-base text-ink"
        />
      </div>
      {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => { setExpanded(false); setTyped('') }}
          className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted"
        >
          Keep my Google data
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-full border border-destructive px-5 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? 'Deleting…' : 'Delete my Google data'}
        </button>
      </div>
    </form>
  )
}
