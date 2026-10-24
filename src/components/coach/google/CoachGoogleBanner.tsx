import { prisma } from '@/lib/prisma'
import { getCoachGoogleStatus } from '@/lib/coach/google/connection'
import { GoogleConnectLink } from '@/components/coach/google/CoachGoogleControls'

// Shown on every coach page when Google access was lost (the coach removed access, the password changed, or Google stopped
// accepting the grant). A coach who chose to disconnect is not nagged. Says what still works and what paused.
// Fail-soft: a read that fails shows nothing rather than breaking the page.
export async function CoachGoogleBanner({ coachId }: { coachId: string }) {
  let upcoming: number | null = null
  try {
    const status = await getCoachGoogleStatus(coachId)
    if (status.feature === 'on' && status.state === 'disconnected' && status.reason !== 'coach') {
      upcoming = await prisma.coachBooking.count({ where: { coachId, status: 'CONFIRMED', startsAt: { gte: new Date() } } })
    }
  } catch (error) {
    console.error('Coach Google banner unavailable:', error)
  }
  if (upcoming === null) return null
  return (
    <section aria-labelledby="google-problem" className="mx-auto mb-6 max-w-4xl space-y-2 rounded-2xl bg-orange/15 p-5">
      <h2 id="google-problem" className="text-xl font-semibold text-ink">
        Google is no longer letting us reach your calendar
      </h2>
      <p className="max-w-3xl text-base text-ink">This usually happens when access is removed in your Google account or the password changes. Reconnect to take bookings again.</p>
      <ul className="max-w-3xl list-disc space-y-1 pl-5 text-sm text-ink">
        <li>New bookings are paused, so no one books a time we can’t check. Clients see that you aren’t taking bookings right now.</li>
        <li>{upcoming === 0 ? 'You have no upcoming sessions.' : `Your ${upcoming} upcoming ${upcoming === 1 ? 'session is' : 'sessions are'} still booked, and their Meet links still work.`}</li>
        <li>New sessions can’t be added to your calendar until you reconnect.</li>
      </ul>
      <div className="pt-1">
        <GoogleConnectLink label="Reconnect Google Calendar" reconnect />
      </div>
    </section>
  )
}
