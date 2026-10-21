import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { accessFor } from '@/lib/access/grants'
import { RedeemCoachCodeForm } from '@/components/dashboard/RedeemCoachCodeForm'
import { earlyCareerAudience } from '@/lib/early-career/audience'
import { coachingIntro } from '@/lib/redesign/network-pages'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { ShowMore } from '@/components/candidate/ShowMore'
import { NetworkParts } from '@/components/network/NetworkParts'

export const metadata: Metadata = { title: 'Coaching' }

const VIA: Record<string, string> = {
  outplacement_seat: 'your former employer’s program',
  coach_code: 'your coach',
  coach: 'your coach',
  admin: 'NextChapter',
  membership: 'your membership',
}

export default async function MyCoachingPage() {
  const profile = await getDashboardProfile()
  const [access, me] = await Promise.all([
    accessFor(profile.id),
    prisma.candidateProfile.findUnique({ where: { id: profile.id }, select: { coach: { select: { id: true, fullName: true, firmName: true, schedulingUrl: true } } } }),
  ])
  const coach = me?.coach ?? null
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const c = access.coaching

  // The redesign (docs/candidate-redesign.md): one primary action for where you are with coaching. The code entry
  // sits behind Show more, and stays one tap away.
  const state = coach ? (coach.schedulingUrl ? 'book' : 'message') : c.on ? 'match' : 'plans'
  captureServerEvent(profile.id, 'coaching_viewed', { state, coachId: coach?.id ?? null, sessionsLeft: c.sessionsLeft })
  const sessions =
    c.on && c.sessionsLeft !== null
      ? `${c.sessionsLeft} session${c.sessionsLeft === 1 ? '' : 's'} left${c.endsAt ? `, until ${fmt.format(c.endsAt)}` : ''}.`
      : null
  return (
    <div className="space-y-8">
      <PageHeader
        title={earlyCareerAudience(profile) ? 'Career coach' : 'Executive coach'}
        intro={coachingIntro(c.on, Boolean(coach))}
        action={
          state === 'book' && coach?.schedulingUrl ? (
            <TrackedAction variant="primary" href={coach.schedulingUrl} external event="coach_booking_link_opened" properties={{ coachId: coach.id, source: 'coaching_primary' }}>
              Book a session
            </TrackedAction>
          ) : state === 'message' && coach ? (
            <TrackedAction variant="primary" href="/dashboard/messages" event="coach_message_opened" properties={{ coachId: coach.id, source: 'coaching_primary' }}>
              Message your coach
            </TrackedAction>
          ) : state === 'match' ? (
            <TrackedAction variant="primary" href="/dashboard/coaching-match" event="coach_match_started" properties={{ source: 'coaching_primary' }}>
              Get matched with a coach
            </TrackedAction>
          ) : (
            <TrackedAction variant="primary" href="/dashboard/premium" event="plans_opened" properties={{ source: 'coaching_primary' }}>
              See plans
            </TrackedAction>
          )
        }
      />
      <NetworkParts current="close" />
      {coach ? (
        <div className="space-y-2 rounded-2xl border border-border p-6">
          <p className="font-display text-xl font-semibold text-ink">{coach.fullName}</p>
          <p className="text-base text-muted-foreground">{coach.firmName ?? 'Independent coach'}</p>
          {c.on && (
            <p className="text-base text-ink">
              Coaching comes with {VIA[c.via ?? 'membership']}.{sessions ? ` ${sessions}` : ''}
            </p>
          )}
          {state === 'book' && (
            <TrackedAction variant="text" href="/dashboard/messages" event="coach_message_opened" properties={{ coachId: coach.id, source: 'coaching_secondary' }}>
              Message your coach
            </TrackedAction>
          )}
          {state === 'message' && <p className="text-sm text-muted-foreground">Your coach has not added a booking link yet. Message them to set a time.</p>}
        </div>
      ) : c.on ? (
        <EmptyCard title="No coach yet" why={`A coach who has worked with people like you keeps your plan moving. ${sessions ?? ''}`.trim()} />
      ) : (
        <EmptyCard title="Coaching is not part of your plan yet" why="Plans with coaching give you one-on-one time with someone who knows your field." />
      )}
      <ShowMore page="my_coaching" label="Have a code from your coach?">
        <RedeemCoachCodeForm />
      </ShowMore>
    </div>
  )
}
