'use client'

import { useState, useTransition } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Mail, CalendarDays } from 'lucide-react'
import { disconnectGmail } from '@/app/dashboard/email-activity/actions'
import { disconnectCalendar } from '@/app/dashboard/calendar-activity/actions'

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

  const pill =
    status === 'connected' ? 'bg-success/10 text-success'
      : status === 'expired' ? 'bg-destructive/10 text-destructive'
        : status === 'partial' ? 'bg-warning/20 text-foreground'
          : 'bg-muted text-muted-foreground'
  const statusLabel = status === 'connected' ? 'Connected' : status === 'expired' ? 'Needs reconnecting'
    : status === 'partial' ? (gmailStatus === 'connected' ? 'Calendar not connected' : 'Gmail not connected') : 'Not connected'
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

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border border-border p-4 ${pending ? 'cursor-wait' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span className="mt-0.5 flex shrink-0 gap-1 text-brand" aria-hidden>
              <Mail className="size-5" />
              <CalendarDays className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                Gmail &amp; Google Calendar
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pill}`}>{statusLabel}</span>
              </p>
              {anyLive && (account || lastChecked) && (
                <p className="text-sm text-muted-foreground">
                  {account}{account && lastChecked ? ' · ' : ''}{lastChecked ? `last checked ${lastChecked}` : ''}
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                Reads job-search email (applications, replies, rejections, networking) and calendar events (interviews,
                networking calls) so they count automatically.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {fullyConnected ? (
              !confirming && (
                <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                  Disconnect
                </button>
              )
            ) : (
              <a
                href={connectHref}
                onClick={() => posthog?.capture('connected_account_connect_clicked', { kind: 'google', reconnect: status !== 'not_connected', from: 'privacy' })}
                className="inline-flex items-center rounded-lg bg-success px-3 py-1.5 text-sm font-semibold text-white hover:bg-success-hover"
              >
                {status === 'not_connected' ? 'Connect Google' : 'Reconnect'}
              </a>
            )}
          </div>
        </div>
        {confirming && (
          <div role="alertdialog" aria-label="Disconnect Google?" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="text-foreground">
              Disconnect Gmail and Calendar? NextChapter stops reading both right away, and new applications, replies and
              interviews won’t count automatically. You can reconnect any time.
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium hover:bg-muted">
                Keep connected
              </button>
              <button type="button" disabled={pending} onClick={disconnect} className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70">
                {pending ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        )}
        {done && <p role="status" className="mt-2 text-sm text-success">Gmail and Calendar disconnected.</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        Read-only: NextChapter never sends, changes or deletes your email or events. Disconnecting stops all reading right away
        and removes NextChapter’s access from your Google account; activity already counted stays.
      </p>
    </div>
  )
}
