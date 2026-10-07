'use client'

import { useState, useTransition } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Mail, CalendarDays } from 'lucide-react'
import { disconnectGmail } from '@/app/dashboard/email-activity/actions'
import { disconnectCalendar } from '@/app/dashboard/calendar-activity/actions'

export type ConnectionState = { status: 'connected' | 'expired' | 'not_connected'; account: string | null; lastChecked: string | null }

/**
 * Connect, reconnect and disconnect Gmail and Calendar. One Google sign-in
 * grants both (read-only); each can be disconnected on its own, and
 * disconnecting both also revokes NextChapter's access in Google.
 * Disconnecting asks for confirmation first (design principles).
 */
export function ConnectedAccountsSettings({
  gmail, calendar, connectHref,
}: {
  gmail: ConnectionState
  calendar: ConnectionState
  connectHref: string
}) {
  return (
    <div className="space-y-3">
      <ConnectionRow kind="gmail" label="Gmail" icon={Mail} state={gmail} connectHref={connectHref}
        what="Reads job-search email (applications, replies, rejections, networking) so it counts automatically." />
      <ConnectionRow kind="calendar" label="Google Calendar" icon={CalendarDays} state={calendar} connectHref={connectHref}
        what="Reads calendar events so interviews and networking calls count automatically." />
      <p className="text-xs text-muted-foreground">
        Read-only: NextChapter never sends, changes or deletes your email or events. Disconnecting stops all reading right away;
        activity already counted stays. Disconnect both and we also remove NextChapter’s access from your Google account.
      </p>
    </div>
  )
}

function ConnectionRow({
  kind, label, icon: Icon, state, connectHref, what,
}: {
  kind: 'gmail' | 'calendar'
  label: string
  icon: typeof Mail
  state: ConnectionState
  connectHref: string
  what: string
}) {
  const posthog = usePostHog()
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()

  const status = done ? 'not_connected' : state.status
  const pill =
    status === 'connected' ? 'bg-success/10 text-success'
      : status === 'expired' ? 'bg-destructive/10 text-destructive'
        : 'bg-muted text-muted-foreground'
  const statusLabel = status === 'connected' ? 'Connected' : status === 'expired' ? 'Needs reconnecting' : 'Not connected'

  function disconnect() {
    start(async () => {
      await (kind === 'gmail' ? disconnectGmail() : disconnectCalendar())
      posthog?.capture('connected_account_disconnected', { kind, from: 'privacy' })
      setDone(true)
      setConfirming(false)
    })
  }

  return (
    <div className={`rounded-xl border border-border p-4 ${pending ? 'cursor-wait' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              {label}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pill}`}>{statusLabel}</span>
            </p>
            {status !== 'not_connected' && (state.account || state.lastChecked) && (
              <p className="text-sm text-muted-foreground">
                {state.account}{state.account && state.lastChecked ? ' · ' : ''}{state.lastChecked ? `last checked ${state.lastChecked}` : ''}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{what}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {status !== 'connected' && (
            <a
              href={connectHref}
              onClick={() => posthog?.capture('connected_account_connect_clicked', { kind, reconnect: status === 'expired', from: 'privacy' })}
              className="inline-flex items-center rounded-lg bg-success px-3 py-1.5 text-sm font-semibold text-white hover:bg-success-hover"
            >
              {status === 'expired' ? 'Reconnect' : `Connect ${label === 'Gmail' ? 'Gmail' : 'Calendar'}`}
            </a>
          )}
          {status !== 'not_connected' && !confirming && (
            <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              Disconnect
            </button>
          )}
        </div>
      </div>
      {confirming && (
        <div role="alertdialog" aria-label={`Disconnect ${label}?`} className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="text-foreground">
            Disconnect {label}? NextChapter stops reading it right away, and new {kind === 'gmail' ? 'applications and replies' : 'interviews and calls'} won’t count automatically. You can reconnect any time.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium hover:bg-muted">
              Keep connected
            </button>
            <button type="button" disabled={pending} onClick={disconnect} className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70">
              {pending ? 'Disconnecting…' : `Disconnect ${label}`}
            </button>
          </div>
        </div>
      )}
      {done && <p role="status" className="mt-2 text-sm text-success">{label} disconnected.</p>}
    </div>
  )
}
