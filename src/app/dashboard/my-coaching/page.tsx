import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { accessFor } from '@/lib/access/grants'
import { buttonVariants } from '@/components/ui/button'
import { RedeemCoachCodeForm } from '@/components/dashboard/RedeemCoachCodeForm'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { earlyCareerAudience } from '@/lib/early-career/audience'

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

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{earlyCareerAudience(profile) ? 'Career coach' : 'Executive coach'}</h1>
        {c.on ? (
          <p className="text-muted-foreground">
            Coaching comes with {VIA[c.via ?? 'membership']}.
            {c.sessionsLeft !== null && ` ${c.sessionsLeft} session${c.sessionsLeft === 1 ? '' : 's'} left`}
            {c.sessionsLeft !== null && c.endsAt ? `, until ${fmt.format(c.endsAt)}.` : c.sessionsLeft !== null ? '.' : ''}
            {c.sessionsLeft === null && c.endsAt ? ` Open until ${fmt.format(c.endsAt)}.` : ''}
          </p>
        ) : (
          <p className="text-muted-foreground">One-on-one coaching for your search. Enter a code from your coach, or see your options.</p>
        )}
      </div>

      {coach ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div>
            <p className="font-medium text-foreground">{coach.fullName}</p>
            <p className="text-sm text-muted-foreground">{coach.firmName ?? 'Independent coach'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {coach.schedulingUrl && (
              <TrackedLink href={coach.schedulingUrl} external event="coach_booking_link_opened" properties={{ coachId: coach.id }} className={buttonVariants()}>
                Book a session
              </TrackedLink>
            )}
            <Link href="/dashboard/messages" className={buttonVariants({ variant: coach.schedulingUrl ? 'outline' : 'default' })}>
              Message your coach
            </Link>
          </div>
          {!coach.schedulingUrl && <p className="text-xs text-muted-foreground">Your coach hasn’t added a booking link yet. Message them to set a time.</p>}
        </div>
      ) : c.on ? (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <p className="font-medium">You don’t have a coach yet</p>
          <p className="text-sm text-muted-foreground">Answer a few questions and we’ll match you with one.</p>
          <Link href="/dashboard/coaching-match" className={buttonVariants()}>Get matched with a coach</Link>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <p className="font-medium">Coaching isn’t part of your plan yet</p>
          <Link href="/dashboard/premium" className={buttonVariants({ variant: 'outline' })}>See plans</Link>
        </div>
      )}

      <RedeemCoachCodeForm />
    </div>
  )
}
