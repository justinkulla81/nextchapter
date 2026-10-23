import { Bell, CalendarCheck, Check, Link2, Video } from 'lucide-react'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Chip, PrimaryButton, SecondaryButton, Section, TextLink } from '@/components/candidate/ui'
import { cn } from '@/lib/utils'
import { Card, Choices, CoachShell, Why } from './coach-shell'

// Sample data only. Today a coach’s sessions go on one shared NextChapter calendar and we never read the coach’s own
// calendar. This mockup is the upgrade: each coach connects their own Google Calendar. Nothing is live.

type State = 'connected' | 'empty' | 'broken'

function Access() {
  return (
    <dl className="grid gap-3 md:grid-cols-3">
      <Card className="space-y-1"><dt className="text-sm font-semibold text-ink">What we read</dt><dd className="text-sm text-ink">Only when you are busy or free, so we never offer a time you’re taken. Not event titles, guests or descriptions.</dd></Card>
      <Card className="space-y-1"><dt className="text-sm font-semibold text-ink">What we write</dt><dd className="text-sm text-ink">One event for each session booked here, with a Meet link, your client as a guest, and reminders. We change or delete only events we made.</dd></Card>
      <Card className="space-y-1"><dt className="text-sm font-semibold text-ink">What we don’t touch</dt><dd className="text-sm text-ink">Your other events, your email and your contacts. You can disconnect any time, in Settings here or in your Google account.</dd></Card>
    </dl>
  )
}

function Week({ off }: { off?: boolean }) {
  const days: [string, string][] = [['Monday', '9:00 am to 12:00 pm'], ['Tuesday', '1:00 pm to 5:00 pm'], ['Wednesday', 'Not available'], ['Thursday', '10:00 am to 4:00 pm'], ['Friday', '9:00 am to 11:00 am']]
  return (
    <ul className={cn('divide-y divide-border rounded-2xl border border-border', off && 'opacity-60')}>
      {days.map(([d, h]) => (
        <li key={d} className="flex items-center justify-between gap-3 px-4 py-3"><span className="text-base font-semibold text-ink">{d}</span><span className={cn('text-sm', h === 'Not available' ? 'text-muted-foreground' : 'text-ink')}>{h}</span></li>
      ))}
    </ul>
  )
}

function Booking() {
  return (
    <Card className="space-y-4 bg-muted/40">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-ink">What Dana sees when she books</p><Chip>Preview</Chip></div>
      <div>
        <p className="font-display text-lg font-semibold text-ink">Book a session with Maya</p>
        <p className="text-sm text-muted-foreground">45 minutes on Google Meet · times in Eastern time</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Open times">
        {['Thu Nov 12, 2:00 pm', 'Thu Nov 12, 3:00 pm', 'Mon Nov 16, 9:00 am', 'Tue Nov 17, 1:00 pm'].map((t, i) => (
          <span key={t} className={cn('rounded-lg border px-3.5 py-2 text-sm font-semibold', i === 0 ? 'border-ink bg-ink text-white' : 'border-border bg-white text-ink')}>{t}</span>
        ))}
      </div>
      <SecondaryButton>Book Thursday at 2:00 pm</SecondaryButton>
      <ul className="space-y-1.5 text-sm text-ink">
        <li className="flex gap-2"><CalendarCheck className="mt-0.5 size-4 shrink-0 text-ink/70" aria-hidden />An invitation with the Meet link goes to Dana’s email and her calendar.</li>
        <li className="flex gap-2"><Bell className="mt-0.5 size-4 shrink-0 text-ink/70" aria-hidden />Reminders one day and one hour before.</li>
        <li className="flex gap-2"><Link2 className="mt-0.5 size-4 shrink-0 text-ink/70" aria-hidden />To change the time, she opens the same booking and picks another slot. The event and Meet link move with it. She can cancel up to 24 hours before.</li>
      </ul>
    </Card>
  )
}

function Scheduling({ state }: { state: State }) {
  const connected = state === 'connected'
  return (
    <CoachShell active="calendar" trail={<>Calendar and booking</>}>
      <PageHeader
        title="Calendar and booking"
        intro="Clients pick a time you are free. Each booking lands on your Google Calendar with a Meet link."
        action={connected ? <PrimaryButton>Save availability</PrimaryButton> : state === 'empty' ? <PrimaryButton>Connect Google Calendar</PrimaryButton> : <PrimaryButton>Reconnect Google Calendar</PrimaryButton>}
      />

      {state === 'broken' && (
        <section aria-labelledby="problem" className="space-y-2 rounded-2xl bg-orange/15 p-5">
          <h2 id="problem" className="font-display text-xl font-semibold text-ink">Google is no longer letting us reach your calendar</h2>
          <p className="max-w-3xl text-base text-ink">This usually happens when access is removed in your Google account or the password changes. Reconnect to take bookings again.</p>
          <ul className="max-w-3xl list-disc space-y-1 pl-5 text-sm text-ink">
            <li>New bookings are paused, so no one books a time we can’t check. Clients see “Maya isn’t taking bookings right now”.</li>
            <li>Your two upcoming sessions (October 29 and November 5) are still booked, and their Meet links still work.</li>
            <li>New sessions can’t be added to your calendar until you reconnect.</li>
          </ul>
        </section>
      )}

      <Section id="cal" title="Your Google Calendar">
        {state === 'empty' ? (
          <Card className="space-y-2">
            <p className="text-base font-semibold text-ink">Not connected yet</p>
            <p className="max-w-3xl text-sm text-muted-foreground">Connect your calendar and clients can book you directly. No one needs to email back and forth, and every session gets a Meet link. You choose what we can see before Google asks you.</p>
            <p className="text-sm text-muted-foreground">Booking is off until you connect, because we need your calendar to know when you are free. <TextLink>Use your own meeting link instead</TextLink></p>
          </Card>
        ) : (
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><Video className="size-5 text-ink/70" aria-hidden /><div><p className="text-base font-semibold text-ink">maya@mayaortizcoaching.com</p><p className="text-sm text-muted-foreground">{connected ? 'Connected October 2 · last checked a minute ago' : 'Last worked October 21 at 4:12 pm'}</p></div></div>
            {connected ? <TextLink>Disconnect</TextLink> : <Chip tone="warm">Needs reconnecting</Chip>}
          </Card>
        )}
        <Access />
        {connected && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">Check these calendars for conflicts</p>
            <Choices label="Calendars" options={['Maya Ortiz', 'Family', 'Workshops']} on="Maya Ortiz" />
            <Why>a session is only offered when none of these show you as busy. Sessions are written to the first one.</Why>
          </div>
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-[1fr_26rem]">
        <Section id="hours" title="When clients can book">
          <Week off={!connected} />
          {!connected && <p className="text-sm text-muted-foreground">Your hours are saved. They show as bookable again once your calendar is connected.</p>}
          <div className={cn('grid gap-4 sm:grid-cols-2', !connected && 'opacity-60')}>
            <div className="space-y-1.5"><p className="text-sm font-semibold text-ink">Session length</p><Choices label="Session length" options={['30', '45', '60']} on="45" /></div>
            <div className="space-y-1.5"><p className="text-sm font-semibold text-ink">Gap between sessions</p><Choices label="Gap" options={['0', '15', '30']} on="15" /></div>
            <div className="space-y-1.5"><p className="text-sm font-semibold text-ink">Notice needed</p><Choices label="Notice" options={['12 h', '24 h', '48 h']} on="24 h" /></div>
            <div className="space-y-1.5"><p className="text-sm font-semibold text-ink">Booking window</p><Choices label="Window" options={['14 days', '21 days', '30 days', '60 days']} on="21 days" /></div>
          </div>
          <Why>hours, gaps and notice are your rules; we only offer times inside them. Time zone: Eastern, so daylight saving never moves your 9:00 am.</Why>
        </Section>

        <Section id="client" title="What your client sees">
          {connected ? (
            <Booking />
          ) : (
            <Card className="space-y-2 bg-muted/40"><p className="text-base font-semibold text-ink">{state === 'empty' ? 'No booking page yet' : 'Booking is paused'}</p><p className="text-sm text-muted-foreground">{state === 'empty' ? 'When you connect, clients get a page with your open times, and you see a preview of it here.' : 'Clients see “Maya isn’t taking bookings right now” and can message you.'}</p></Card>
          )}
        </Section>
      </div>

      {connected && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="size-4" aria-hidden />After a session, if Meet saved notes to the calendar event, we offer to add them to your session notes. You decide what goes in.</p>
      )}
    </CoachShell>
  )
}

export const CoachSchedulingConnected = () => <Scheduling state="connected" />
export const CoachSchedulingEmpty = () => <Scheduling state="empty" />
export const CoachSchedulingBroken = () => <Scheduling state="broken" />
