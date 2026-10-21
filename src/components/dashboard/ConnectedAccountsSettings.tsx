'use client'

import { useState, useTransition } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { disconnectGmail } from '@/app/dashboard/email-activity/actions'
import { disconnectCalendar } from '@/app/dashboard/calendar-activity/actions'
import { googleConnectionLine } from '@/lib/redesign/network-account'

export type ConnectionState = { status: 'connected' | 'expired' | 'not_connected'; account: string | null; lastChecked: string | null }

/**
 * One Google connection, one button. A single Google sign-in grants Gmail and
 * Calendar together (read-only), so the card toggles both at once: Connect
 * when either is missing or expired, Disconnect when both are live.
 * Disconnecting both also revokes NextChapter's access in Google, and asks
 * for confirmation first (design principles).
 */
export function ConnectedAccountsSettings({
  gmail, calendar, connectHref,
}: {
  gmail: ConnectionState
  calendar: ConnectionState
  connectHref: string
}) {
  const posthog = usePostHog()
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()

  const gmailStatus = done ? 'not_connected' : gmail.status
  const calendarStatus = done ? 'not_connected' : calendar.status
  const anyLive = gmailStatus !== 'not_connected' || calendarStatus !== 'not_connected'
  const fullyConnected = gmailStatus === 'connected' && calendarStatus === 'connected'
  const expired = gmailStatus === 'expired' || calendarStatus === 'expired'
  const status = fullyConnected ? 'connected' : expired ? 'expired' : anyLive ? 'partial' : 'not_connected'
  const account = gmail.account ?? calendar.account
  const lastChecked = gmail.lastChecked ?? calendar.lastChecked

  function disconnect() {
    start(async () => {
      // Sequential: the second call sees both rows disconnected and revokes the Google grant.
      if (gmail.status !== 'not_connected') await disconnectGmail()
      if (calendar.status !== 'not_connected') await disconnectCalendar()
      posthog?.capture('connected_account_disconnected', { kind: 'google', from: 'privacy' })
      setDone(true)
      setConfirming(false)
    })
  }

  // The redesign: the colored status pill and the bordered card become a sentence that says what is true and what it
  // costs you, then the one action. Disconnecting still asks first, and "Keep connected" is the safe default.
  const line = googleConnectionLine(gmailStatus, calendarStatus)
  return (
    <div className={`space-y-3 ${pending ? 'cursor-wait' : ''}`}>
      <p className="text-base font-semibold text-ink">Gmail and Google Calendar</p>
      <p className="max-w-xl text-base text-ink">{line.text}</p>
      {anyLive && (account || lastChecked) && (
        <p className="text-sm text-muted-foreground">
          {account}
          {account && lastChecked ? ', ' : ''}
          {lastChecked ? `last checked ${lastChecked}` : ''}
        </p>
      )}
      <p className="max-w-xl text-sm text-muted-foreground">
        We read job-search email (applications, replies, rejections, networking) and calendar events (interviews, networking calls) so they count automatically. It is read-only: NextChapter never sends, changes or deletes your email or events. Disconnecting stops all reading right away, removes our access from your Google account and deletes your stored Google sign-in. Activity already counted stays. To delete that too, use{' '}
        <a href="#google-data" className="underline underline-offset-4">Delete my Google data</a>.
      </p>
      {fullyConnected ? (
        !confirming && (
          <button type="button" onClick={() => setConfirming(true)} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">
            Disconnect Google
          </button>
        )
      ) : (
        <a
          href={connectHref}
          onClick={() => posthog?.capture('connected_account_connect_clicked', { kind: 'google', reconnect: status !== 'not_connected', from: 'privacy' })}
          className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95"
        >
          {status === 'not_connected' ? 'Connect Google' : 'Reconnect Google'}
        </a>
      )}
      {confirming && (
        <div role="alertdialog" aria-label="Disconnect Google?" className="max-w-xl space-y-3">
          <p className="text-base text-ink">Disconnect Gmail and Calendar? We stop reading both right away, and new applications, replies and interviews will not count automatically. You can reconnect any time.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setConfirming(false)} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">
              Keep connected
            </button>
            <button type="button" disabled={pending} onClick={disconnect} className="inline-flex h-10 items-center rounded-full border border-destructive px-5 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:cursor-wait disabled:opacity-70">
              {pending ? 'Disconnecting…' : 'Yes, disconnect'}
            </button>
          </div>
        </div>
      )}
      {done && (
        <p role="status" className="text-base text-ink">
          Gmail and Calendar disconnected.
        </p>
      )}
    </div>
  )
}
