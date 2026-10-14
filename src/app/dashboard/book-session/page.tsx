import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getBookingConfig, listOpenSlots, listUpcomingForCandidate } from '@/lib/coach/booking/service'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { SlotPicker } from '@/components/dashboard/book-session/SlotPicker'
import { LocalTime } from '@/components/dashboard/book-session/LocalTime'
import { CancelSessionForm } from '@/components/dashboard/book-session/CancelSessionForm'

export const metadata: Metadata = { title: 'Book a coaching session' }

export default async function BookSessionPage() {
  const profile = await getDashboardProfile()

  const header = (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Book a coaching session</h1>
    </div>
  )

  if (!profile.coachId) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={CalendarClock}
          title="You do not have a coach yet"
          description="Choose a coach first, then you can book sessions with them here."
          cta={{ label: 'Find a coach', href: '/dashboard/coaching-match' }}
        />
      </div>
    )
  }

  let coach: { id: string; fullName: string } | null = null
  let config: Awaited<ReturnType<typeof getBookingConfig>>['config'] | null = null
  let slots: Date[] = []
  let upcoming: Awaited<ReturnType<typeof listUpcomingForCandidate>> = []
  let failed = false
  try {
    coach = await prisma.coach.findUnique({ where: { id: profile.coachId }, select: { id: true, fullName: true } })
    if (coach) {
      const [cfg, open, mine] = await Promise.all([getBookingConfig(coach.id), listOpenSlots(coach.id), listUpcomingForCandidate(profile.id)])
      config = cfg.config
      slots = open
      upcoming = mine
    }
  } catch (error) {
    console.error('Failed to load coach booking page:', error)
    failed = true
  }

  if (failed || !coach || !config) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState icon={CalendarClock} title="We could not load booking right now" description="Reload the page in a moment. If it keeps happening, tell us from the help button." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}
      <p className="text-muted-foreground">Pick a time that works with {coach.fullName}. You and your coach both get a calendar invitation.</p>

      {upcoming.length > 0 && (
        <section className="space-y-3" aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="text-lg font-semibold tracking-tight">
            Your upcoming sessions
          </h2>
          <ul className="space-y-3">
            {upcoming.map((b) => (
              <li key={b.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-foreground">
                        <LocalTime iso={b.startsAt.toISOString()} fallback={b.startsAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: config.timezone, timeZoneName: 'short' })} />
                      </p>
                      {b.meetUrl && (
                        <p>
                          <a href={b.meetUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
                            Join the video call
                          </a>
                        </p>
                      )}
                    </div>
                    <CancelSessionForm bookingId={b.id} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="book-heading">
        <h2 id="book-heading" className="text-lg font-semibold tracking-tight">
          Book a new session
        </h2>
        {!config.enabled ? (
          <EmptyState
            icon={CalendarClock}
            title={`${coach.fullName.split(' ')[0]} has not opened their calendar yet`}
            description="Send them a message and ask when they are free. They can turn on booking from their coach settings."
            cta={{ label: 'Message your coach', href: '/dashboard/messages' }}
          />
        ) : slots.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No open times right now" description={`${coach.fullName.split(' ')[0]} has no open times in the next ${config.maxDaysAhead} days. Check back soon, or send them a message.`} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <SlotPicker slots={slots.map((s) => s.toISOString())} coachId={coach.id} coachName={coach.fullName} />
            </CardContent>
          </Card>
        )}
      </section>

      <p className="text-sm">
        <Link href="/dashboard/coaching-match" className="text-primary underline-offset-4 hover:underline">
          Change your coach
        </Link>
      </p>
    </div>
  )
}
