import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { getCoachImpactReport } from '@/lib/coach/impact-report'
import { getCoachUnreadCount } from '@/lib/messaging/threads'
import { getCoachCaseload } from '@/lib/coach/caseload'

const HIGH_NEED_TAG = 'comfort_with_high_need_candidates'
const SPECIALIST_MIN_CLIENTS = 2

export default async function CoachHomePage() {
  const coach = await getCurrentCoach()

  const [clientCount, impact, unreadMessages, caseload, pendingInvites] = await Promise.all([
    prisma.candidateProfile.count({ where: { coachId: coach.id } }),
    getCoachImpactReport(coach.id),
    getCoachUnreadCount(coach.id),
    getCoachCaseload(coach.id),
    prisma.coachClientInvite.count({ where: { coachId: coach.id, acceptedAt: null } }),
  ])
  const isSpecialist = coach.specializationTags.includes(HIGH_NEED_TAG) && clientCount >= SPECIALIST_MIN_CLIENTS
  const stalled = caseload.filter((c) => c.isStalled)

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Coaches</p>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {coach.fullName.split(' ')[0]}</h1>
        {coach.firmName && <p className="mt-1 text-muted-foreground">{coach.firmName}</p>}
        {isSpecialist && (
          <span className="mt-2 inline-block rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
            High-need specialist
          </span>
        )}
      </div>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Needs your attention</h2>
        {stalled.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No clients showing signs of stalling right now.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {stalled.map((client) => (
              <Link
                key={client.id}
                href={`/support/coach/clients/${coach.accessToken}/${client.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-primary"
              >
                <div>
                  <p className="font-medium text-foreground">{client.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {client.weekNumber !== null ? `Week ${client.weekNumber}` : 'Not yet started'}
                    {client.executionGrade ? ` · Grade ${client.executionGrade}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-orange/20 px-2.5 py-0.5 text-sm font-semibold text-orange">
                  Stalled
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">This quarter</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{clientCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Active clients</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{impact.improved}</p>
            <p className="mt-1 text-sm text-muted-foreground">Improved their grade</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{impact.declined}</p>
            <p className="mt-1 text-sm text-muted-foreground">Declined</p>
          </div>
        </div>
        {impact.clientCount > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            {impact.same} held steady{impact.noData > 0 ? `, ${impact.noData} not enough data yet` : ''}.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Notifications</h2>
        <div className="mt-3 space-y-2">
          <Link href="/support/coach/messages" className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">Messages</p>
            {unreadMessages > 0 && (
              <span className="rounded-full bg-orange/20 px-2.5 py-0.5 text-sm font-semibold text-orange">
                {unreadMessages} unread
              </span>
            )}
          </Link>
          {pendingInvites > 0 && (
            <Link
              href="/support/coach/invite-client"
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-primary"
            >
              <p className="font-medium text-foreground">Invites awaiting response</p>
              <span className="rounded-full bg-orange/20 px-2.5 py-0.5 text-sm font-semibold text-orange">
                {pendingInvites}
              </span>
            </Link>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Quick links</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/support/coach/clients/${coach.accessToken}`}
            className="rounded-lg border border-border p-4 hover:border-primary"
          >
            <p className="font-medium text-foreground">Your clients</p>
            <p className="mt-1 text-sm text-muted-foreground">Pre-session briefs and full client views.</p>
          </Link>
          <Link
            href={`/support/coach/caseload/${coach.accessToken}`}
            className="rounded-lg border border-border p-4 hover:border-primary"
          >
            <p className="font-medium text-foreground">Caseload</p>
            <p className="mt-1 text-sm text-muted-foreground">Roster-level grade trends and who&apos;s stalled.</p>
          </Link>
          <Link href="/support/coach/invite-client" className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">Invite a client by email</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Invite someone directly — they skip the confirmation step and start right away.
            </p>
          </Link>
          <Link
            href={`/support/coach/invite/${coach.accessToken}`}
            className="rounded-lg border border-border p-4 hover:border-primary"
          >
            <p className="font-medium text-foreground">Share invite link</p>
            <p className="mt-1 text-sm text-muted-foreground">A generic link anyone can sign up through.</p>
          </Link>
          <Link href="/support/coach/settings" className="rounded-lg border border-border p-4 hover:border-primary">
            <p className="font-medium text-foreground">Settings</p>
            <p className="mt-1 text-sm text-muted-foreground">Branding and your Coaching Onboarding Form.</p>
          </Link>
        </div>
      </section>

      <div className="border-t border-border pt-4">
        <a href="/auth/forgot-password" className="text-sm text-muted-foreground underline underline-offset-4">
          Change password
        </a>
      </div>
    </div>
  )
}
