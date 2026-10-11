import type { Metadata } from 'next'
import { PortalActivityTracker } from '@/components/portal/PortalActivityTracker'
import { CoachNav } from '@/components/coach/CoachNav'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { getCoachUnreadCount } from '@/lib/messaging/threads'
import { getCoachCaseload } from '@/lib/coach/caseload'
import { RoleContextBanner } from '@/components/auth/RoleContextBanner'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function CoachAppLayout({ children }: { children: React.ReactNode }) {
  const coach = await getCurrentCoach()

  const [messagesUnreadCount, caseload, college] = await Promise.all([
    getCoachUnreadCount(coach.id),
    getCoachCaseload(coach.id),
    // A college's own coach: say which college, so it's clear whose members
    // they're seeing and that those sessions count toward that college.
    prisma.coach
      .findUnique({ where: { id: coach.id }, select: { institution: { select: { name: true, programBrandName: true } } } })
      .then((c) => c?.institution ?? null),
  ])
  // Nav badge counts every client needing attention — an avoidance pattern
  // OR a real risk trigger (§A5.2) — deduped so one client flagged both ways
  // only counts once.
  const attentionNeededCount = caseload.filter(
    (c) => c.isStalled || c.triggers.some((t) => t.type === 'RISK')
  ).length

  return (
    <div className="theme-partner min-h-screen">
      <PortalActivityTracker portal="COACH" />
      <CoachNav accessToken={coach.accessToken} messagesUnreadCount={messagesUnreadCount} actionCount={attentionNeededCount} />
      {/* pt-14 clears the fixed top bar exactly once, whether or not the
          banner below renders — see RoleContextBanner's comment for why an
          explicit offset (rather than relying on fixed chrome painting over
          it) is required. */}
      <div className="pt-14">
        {coach.userId && (
          <RoleContextBanner
            userId={coach.userId}
            currentRole="coach"
            personName={coach.fullName}
            className="lg:pl-[calc(16rem+1.5rem)]"
          />
        )}
        <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
          {college && (
            <p className="mx-auto mb-6 max-w-4xl rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              You coach for {college.programBrandName ?? college.name}. Its members see you first when they choose a coach, and your sessions
              with them count toward {college.name}. Session notes stay private to you and the member.
            </p>
          )}
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
