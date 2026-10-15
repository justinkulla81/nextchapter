import type { Metadata } from 'next'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { getBookingConfig, listUpcomingForCoach } from '@/lib/coach/booking/service'
import { BookingSettingsForm } from '@/components/coach/BookingSettingsForm'
import { CancelCoachSessionForm } from '@/components/coach/CancelCoachSessionForm'

export const metadata: Metadata = { title: 'Booking' }

export default async function CoachBookingPage() {
  const coach = await getCurrentCoach()
  const [{ config, windows }, upcoming] = await Promise.all([getBookingConfig(coach.id), listUpcomingForCoach(coach.id)])
  const timeZones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [config.timezone]

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Booking</h1>
        <p className="text-muted-foreground">
          Set your weekly hours and your clients can book sessions with you. We add each session to a shared Google Calendar with a Meet link and invite you both. We do not read your own calendar, so
          keep your hours current and cancel a session here if something comes up.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-lg font-semibold tracking-tight">
          Upcoming sessions
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No sessions booked yet.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((b) => {
              const clientName = [b.candidate.firstName, b.candidate.lastName].filter(Boolean).join(' ') || 'your client'
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">{b.startsAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: config.timezone, timeZoneName: 'short' })}</p>
                    <p className="text-muted-foreground">With {clientName}</p>
                    {b.meetUrl && (
                      <a href={b.meetUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
                        Join the video call
                      </a>
                    )}
                  </div>
                  <CancelCoachSessionForm bookingId={b.id} clientName={clientName} />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="text-lg font-semibold tracking-tight">
          Your hours and settings
        </h2>
        <BookingSettingsForm config={config} windows={windows} timeZones={timeZones} />
      </section>
    </div>
  )
}
