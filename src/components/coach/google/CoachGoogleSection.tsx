import { Video } from 'lucide-react'
import { Chip } from '@/components/candidate/ui'
import { ConflictCalendars, DisconnectGoogleForm, GoogleConnectLink, GoogleConnectUnavailable } from '@/components/coach/google/CoachGoogleControls'
import type { CoachGoogleStatus } from '@/lib/coach/google/connection'

// The "Your Google Calendar" part of Calendar and booking, from the approved mockup (dev-preview coach-scheduling.tsx).
// Three states: connected, not connected, and needs reconnecting. While the feature is off it says so and changes nothing.

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={`rounded-2xl border border-border p-5 ${className}`}>{children}</div>

function Access() {
  return (
    <dl className="grid gap-3 md:grid-cols-3">
      <Card className="space-y-1">
        <dt className="text-sm font-semibold text-ink">What we read</dt>
        <dd className="text-sm text-ink">Only when you are busy or free, so we never offer a time you’re taken. Not event titles, guests or descriptions. Google enforces this: we only ask for that permission.</dd>
      </Card>
      <Card className="space-y-1">
        <dt className="text-sm font-semibold text-ink">What we write</dt>
        <dd className="text-sm text-ink">One event for each session booked here, with a Meet link, your client as a guest, and reminders. We change or delete only events we made.</dd>
      </Card>
      <Card className="space-y-1">
        <dt className="text-sm font-semibold text-ink">What we don’t touch</dt>
        <dd className="text-sm text-ink">Your other events, your email and your contacts. You can disconnect any time, here or in your Google account.</dd>
      </Card>
    </dl>
  )
}

const when = (d: Date | null) => (d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null)

export function CoachGoogleSection({ status, message }: { status: CoachGoogleStatus; message?: { kind: 'error' | 'ok'; text: string } | null }) {
  return (
    <section aria-labelledby="google-heading" className="space-y-3">
      <h2 id="google-heading" className="font-display text-xl font-semibold text-ink">
        Your Google Calendar
      </h2>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'rounded-2xl bg-orange/15 p-4 text-sm text-ink' : 'rounded-2xl bg-success/10 p-4 text-sm text-ink'}>
          {message.text}
        </p>
      )}

      {status.feature === 'off' && (
        <Card className="space-y-3">
          <p className="text-base font-semibold text-ink">Connecting your own calendar is coming</p>
          <p className="max-w-3xl text-sm text-muted-foreground">When it is on, clients will only be offered times you are free, and each session will land on your own Google Calendar with a Meet link.</p>
          <GoogleConnectUnavailable />
        </Card>
      )}

      {status.feature === 'on' && status.state === 'none' && (
        <Card className="space-y-3">
          <p className="text-base font-semibold text-ink">Not connected yet</p>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Connect your calendar and clients are only offered times you are free, and every session lands on your own calendar with a Meet link. You see what we can read before Google asks you.
          </p>
          <p className="text-sm text-muted-foreground">Until you connect, sessions go on the shared NextChapter calendar and we do not check your own calendar, so keep your hours below current.</p>
          <GoogleConnectLink label="Connect Google Calendar" />
        </Card>
      )}

      {status.feature === 'on' && status.state === 'connected' && (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Video className="size-5 text-ink/70" aria-hidden />
              <div>
                <p className="text-base font-semibold text-ink">{status.email}</p>
                <p className="text-sm text-muted-foreground">
                  Connected {when(status.connectedAt)}
                  {status.lastCheckedAt ? ` · last checked ${status.lastCheckedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
                </p>
              </div>
            </div>
            <DisconnectGoogleForm />
          </Card>
          <Access />
          <ConflictCalendars calendarIds={status.calendarIds} email={status.email} />
        </>
      )}

      {status.feature === 'on' && status.state === 'disconnected' && (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Video className="size-5 text-ink/70" aria-hidden />
              <div>
                <p className="text-base font-semibold text-ink">{status.email}</p>
                <p className="text-sm text-muted-foreground">{status.reason === 'coach' ? `You disconnected it${status.disconnectedAt ? ` on ${when(status.disconnectedAt)}` : ''}` : `Stopped working${status.disconnectedAt ? ` on ${when(status.disconnectedAt)}` : ''}`}</p>
              </div>
            </div>
            <Chip tone="warm">{status.reason === 'coach' ? 'Disconnected' : 'Needs reconnecting'}</Chip>
          </Card>
          <GoogleConnectLink label="Reconnect Google Calendar" reconnect />
          <Access />
        </>
      )}
    </section>
  )
}
