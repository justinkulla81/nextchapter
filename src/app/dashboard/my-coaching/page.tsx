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
import { Chip, Section } from '@/components/candidate/ui'
import { CoachTopics } from '@/components/dashboard/coach-update/CoachTopics'
import { MarkCoachSummaryViewed } from '@/components/dashboard/coach-update/MarkCoachSummaryViewed'
import { getMemberCoachingView } from '@/lib/coach/session-notes-service'
import { doingLabel, formatDue, ownerLabel } from '@/lib/coach/session-notes'

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
  const [access, me, update] = await Promise.all([
    accessFor(profile.id),
    prisma.candidateProfile.findUnique({ where: { id: profile.id }, select: { coach: { select: { id: true, fullName: true, firmName: true, schedulingUrl: true } } } }),
    // What the coach sent after a session. Null when nothing was sent (or the tables are not there yet).
    getMemberCoachingView(profile.id),
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
  const coachCard = coach ? (
    <div className="space-y-2 rounded-2xl border border-border p-6">
      <p className="font-display text-xl font-semibold text-ink">{coach.fullName}</p>
      <p className="text-base text-muted-foreground">{coach.firmName ?? 'Independent coach'}</p>
      {c.on && (
        <p className="text-base text-ink">
          Coaching comes with {VIA[c.via ?? 'membership']}.{sessions ? ` ${sessions}` : ''}
        </p>
      )}
      {state === 'book' && coach.schedulingUrl && update && (
        <div>
          <TrackedAction variant="text" href={coach.schedulingUrl} external event="coach_booking_link_opened" properties={{ coachId: coach.id, source: 'coaching_secondary' }}>
            Book your next session
          </TrackedAction>
        </div>
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
  )

  // When the coach has sent an update, it is the page: the headline is the session, the one action is your week, and
  // the coach card, booking and code entry move behind Show more (docs/candidate-redesign.md: three sections at most).
  if (update) {
    const memberSteps = update.followUps.filter((f) => f.ownerKind === 'member').length
    return (
      <div className="space-y-8">
        <MarkCoachSummaryViewed summaryId={update.summaryId} />
        <PageHeader
          title={`Your session with ${update.coachFirstName}`}
          intro={`${update.coachFirstName} sent this after your ${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(update.sentAt)} call.${memberSteps > 0 ? ' Your steps are in Your week.' : ''}`}
          action={
            <TrackedAction variant="primary" href="/dashboard" event="coach_update_week_opened" properties={{ sessionId: update.sessionId }}>
              Open your week
            </TrackedAction>
          }
        />
        <NetworkParts current="close" />
        <CoachUpdate update={update} />
        <ShowMore page="my_coaching" label="Your coach, booking and code" properties={{ hasUpdate: true }}>
          {coachCard}
          <RedeemCoachCodeForm />
        </ShowMore>
      </div>
    )
  }

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
      {coachCard}
      <ShowMore page="my_coaching" label="Have a code from your coach?">
        <RedeemCoachCodeForm />
      </ShowMore>
    </div>
  )
}

type Update = NonNullable<Awaited<ReturnType<typeof getMemberCoachingView>>>

// The three sections of a coach update, in the order the member acts on them (src/app/dev-preview/_mockups/coach-candidate.tsx).
function CoachUpdate({ update }: { update: Update }) {
  const coach = update.coachFirstName
  return (
    <div className="space-y-8">
      {update.followUps.length > 0 && (
        <Section id="steps" title="What you agreed">
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {update.followUps.map((f) => {
              const due = formatDue(f.dueOn)
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-base font-semibold text-ink">{f.text}</p>
                    <p className="text-sm text-muted-foreground">{ownerLabel(f.ownerKind, coach)}{due ? ` · due ${due}` : ''}{f.status === 'done' ? ' · done' : ''}</p>
                  </div>
                  <Chip tone={f.ownerKind === 'member' ? 'good' : 'muted'}>{f.status === 'done' ? 'Done' : doingLabel(f.ownerKind, coach)}</Chip>
                </li>
              )
            })}
          </ul>
          <p className="text-sm text-muted-foreground">Why: these are the steps you and {coach} agreed on the call. Yours are in Your week with their dates, and you tick them off there. {coach} does the ones marked with their name.</p>
        </Section>
      )}
      {update.topics.length > 0 && (
        <Section id="topics" title={`Topics ${coach} heard you want help with`}>
          <CoachTopics coachFirstName={coach} topics={update.topics} />
        </Section>
      )}
      <Section id="summary" title={`${coach}’s summary`}>
        <div className="space-y-3 rounded-2xl border border-border p-6">
          {update.summaryText.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="max-w-2xl text-base leading-relaxed whitespace-pre-line text-ink">{p}</p>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Why: {coach} wrote this for you after your session, so you have the agreement in one place.</p>
      </Section>
    </div>
  )
}
