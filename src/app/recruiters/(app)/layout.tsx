import type { Metadata } from 'next'
import { PortalActivityTracker } from '@/components/portal/PortalActivityTracker'
import { RecruiterNav } from '@/components/recruiter/RecruiterNav'
import { getCurrentRecruiter } from '@/lib/recruiter/current-recruiter'
import { getRecruiterUnreadCount } from '@/lib/messaging/threads'
import { prisma } from '@/lib/prisma'
import { RoleContextBanner } from '@/components/auth/RoleContextBanner'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function RecruiterAppLayout({ children }: { children: React.ReactNode }) {
  const recruiter = await getCurrentRecruiter()

  const [messagesUnreadCount, addedNotYetInvited, talentDraftCount] = await Promise.all([
    getRecruiterUnreadCount(recruiter.id),
    prisma.sourcedCandidate.count({ where: { recruiterId: recruiter.id, status: 'ADDED' } }),
    // Badge only counts replies on candidates assigned to this recruiter;
    // the general hopper is surfaced on the Talent page itself.
    recruiter.firmRole
      ? prisma.intakeReply.count({
          where: { status: 'DRAFT', connection: { recruiterId: recruiter.id, disconnectedAt: null } },
        })
      : Promise.resolve(0),
  ])

  return (
    <div className="theme-partner min-h-screen">
      <PortalActivityTracker portal="RECRUITER" />
      <RecruiterNav
        accessToken={recruiter.accessToken}
        messagesUnreadCount={messagesUnreadCount}
        actionCount={addedNotYetInvited}
        talentDraftCount={talentDraftCount}
      />
      {/* pt-14 clears the fixed top bar exactly once, whether or not the
          banner below renders — see RoleContextBanner's comment for why an
          explicit offset (rather than relying on fixed chrome painting over
          it) is required. */}
      <div className="pt-14">
        {recruiter.userId && (
          <RoleContextBanner
            userId={recruiter.userId}
            currentRole="recruiter"
            personName={recruiter.fullName}
            className="lg:pl-[calc(16rem+1.5rem)]"
          />
        )}
        <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
