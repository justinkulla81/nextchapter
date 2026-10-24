import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PortalHelpLauncher } from '@/components/portal/PortalHelpLauncher'
import { PortalActivityTracker } from '@/components/portal/PortalActivityTracker'
import { RecruiterNav } from '@/components/recruiter/RecruiterNav'
import { getCurrentRecruiter } from '@/lib/recruiter/current-recruiter'
import { getRecruiterUnreadCount } from '@/lib/messaging/threads'
import { prisma } from '@/lib/prisma'
import { RoleContextBanner } from '@/components/auth/RoleContextBanner'
import { brandStyle, type PartnerBrand } from '@/lib/partners/brand'
import { recruiterBrand } from '@/lib/partners/resolve-brand'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// The counts only feed nav badges, so they stream in their own Suspense
// boundary: the nav and {children} paint without waiting on them.
// getCurrentRecruiter() has already run in the layout before this renders.
async function RecruiterNavWithBadges({
  recruiterId,
  firmRole,
  accessToken,
  brand,
}: {
  recruiterId: string
  firmRole: string | null
  accessToken: string
  brand: PartnerBrand
}) {
  const [messagesUnreadCount, addedNotYetInvited, talentDraftCount] = await Promise.all([
    getRecruiterUnreadCount(recruiterId),
    prisma.sourcedCandidate.count({ where: { recruiterId, status: 'ADDED' } }),
    // Badge only counts replies on candidates assigned to this recruiter;
    // the general hopper is surfaced on the Talent page itself.
    firmRole
      ? prisma.intakeReply.count({
          where: { status: 'DRAFT', connection: { recruiterId, disconnectedAt: null } },
        })
      : Promise.resolve(0),
  ])
  return (
    <RecruiterNav
      accessToken={accessToken}
      messagesUnreadCount={messagesUnreadCount}
      actionCount={addedNotYetInvited}
      talentDraftCount={talentDraftCount}
      brand={brand}
    />
  )
}

export default async function RecruiterAppLayout({ children }: { children: React.ReactNode }) {
  const recruiter = await getCurrentRecruiter()

  const brand = await recruiterBrand(recruiter)

  return (
    <div className="theme-partner min-h-screen" style={brandStyle(brand)}>
      <PortalActivityTracker portal="RECRUITER" />
      <PortalHelpLauncher portal="RECRUITER" />
      <Suspense fallback={<RecruiterNav accessToken={recruiter.accessToken} brand={brand} />}>
        <RecruiterNavWithBadges
          recruiterId={recruiter.id}
          firmRole={recruiter.firmRole}
          accessToken={recruiter.accessToken}
          brand={brand}
        />
      </Suspense>
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
