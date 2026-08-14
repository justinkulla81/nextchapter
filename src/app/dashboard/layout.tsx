import type { Metadata } from 'next'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getSupportNetworkUnreadCount } from '@/lib/community/unread-count'
import { getCandidateUnreadCount } from '@/lib/messaging/threads'
import { getPeerUnreadCount } from '@/lib/messaging/peer-threads'
import { IdentifyUser } from '@/lib/posthog/IdentifyUser'
import { buildPortfolioAssetChecklist } from '@/lib/portfolio/asset-checklist'
import { getBackchannelMatches } from '@/lib/network/backchannel'
import { HashScrollFix } from '@/components/dashboard/HashScrollFix'
import { getHardGateStatus, isGmailConnected, isGateExemptPath } from '@/lib/dashboard/access-gate'
import { HardGateBlockingScreen } from '@/components/dashboard/HardGateBlockingScreen'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// The first-registration report generation + email (see get-dashboard-data.ts's
// after() block) and the on-demand resolveLatestReport() in page.tsx both run
// an Opus call plus market-data lookups in the background after the response
// is sent. after() callbacks share the SAME invocation's maxDuration as the
// initial render, not a separate budget, so this needs to be long enough for
// that background work to finish — not just long enough for the page itself.
// 300 is the actual ceiling on this project's plan (Hobby + Fluid Compute).
export const maxDuration = 300

// Every dashboard page.tsx calls getDashboardData() again for its own data
// (now free — see that function's cache() wrap), but the 7 queries below are
// ONLY for nav badge counts, nothing else on the page needs them. Isolated
// into their own Suspense boundary so DashboardNav (and {children}, which
// starts streaming independently once this layout returns) don't wait on
// them — the nav renders immediately with its badges filled in a beat
// later, instead of every page's first paint blocking on badge math.
async function DashboardNavWithBadges({ profileId }: { profileId: string }) {
  const [
    narrativeCount,
    marketRealitySnapshotCount,
    learningBadgeCount,
    supportNetworkUnreadCount,
    candidateMessagesUnreadCount,
    peerUnreadCount,
    backchannelMatches,
  ] = await Promise.all([
    prisma.candidateNarrative.count({ where: { candidateId: profileId } }),
    prisma.marketRealitySnapshot.count({ where: { candidateId: profileId } }),
    prisma.learningBadge.count({ where: { candidateId: profileId } }),
    getSupportNetworkUnreadCountForBadge(profileId),
    getCandidateUnreadCount(profileId),
    getPeerUnreadCount(profileId),
    getBackchannelMatchesForBadge(profileId),
  ])
  // Sidebar's single "Messages" badge covers all 4 relationship tabs
  // (Peers/Coaches/Recruiters/Hiring Managers) now that they're one surface —
  // see community/page.tsx's MessagesTab.
  const messagesUnreadCount = candidateMessagesUnreadCount + peerUnreadCount
  const newBackchannelCount = backchannelMatches.filter((m) => m.isNew).length

  // Re-fetches the same cached profile (see getDashboardData's cache() wrap)
  // for the fields buildPortfolioAssetChecklist needs — cheap, request-memoized.
  const profile = await getDashboardData()
  // See buildPortfolioAssetChecklist — the Portfolio page computes this
  // same checklist from the same shape of inputs, so the nav badge and the
  // page's own "X of 8 assets" count can never disagree.
  const portfolioAssetCount = buildPortfolioAssetChecklist({
    hasResume: profile.resumes.length > 0,
    hasCoverLetter: profile.jobPostings.some((j) => !!j.coverLetter),
    hasNarrative: narrativeCount > 0,
    hasHireabilityReport: profile.hireabilityReports.length > 0,
    hasMarketRealityReport: marketRealitySnapshotCount > 0,
    hasWorkSample: profile.workSamples.length > 0,
    hasCompletedReference: profile.references.some((r) => r.status === 'COMPLETED'),
    hasLearningBadge: learningBadgeCount > 0,
  }).filter((a) => a.done).length

  return (
    <DashboardNav
      portfolioAssetCount={portfolioAssetCount}
      supportNetworkUnreadCount={supportNetworkUnreadCount}
      messagesUnreadCount={messagesUnreadCount}
      newBackchannelCount={newBackchannelCount}
    />
  )
}

// getSupportNetworkUnreadCount/getBackchannelMatches need profile fields
// beyond just the id (communityLastViewedAt / networkBackchannelLastViewedAt)
// — small wrappers so the Promise.all above can read the (cached) profile
// without threading two extra params through DashboardNavWithBadges' props.
async function getSupportNetworkUnreadCountForBadge(profileId: string) {
  const profile = await getDashboardData()
  return getSupportNetworkUnreadCount(profileId, profile.communityLastViewedAt)
}
async function getBackchannelMatchesForBadge(profileId: string) {
  const profile = await getDashboardData()
  return getBackchannelMatches(profileId, profile.networkBackchannelLastViewedAt)
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getDashboardData()

  // Dashboard-wide hard gate (see access-gate.ts) — only ever applies to
  // candidates created after this shipped (profile.subjectToHardGate) and
  // only outside a small allowlist of routes (the gate's own required pages
  // + account-level pages that must always stay reachable).
  const pathname = (await headers()).get('x-pathname') ?? ''
  let gateContent: React.ReactNode = null
  if (profile.subjectToHardGate && !isGateExemptPath(pathname)) {
    const gmailConnected = await isGmailConnected(profile.id)
    const status = getHardGateStatus(profile, gmailConnected)
    if (status === 'search_strategy_required' || status === 'activation_required') {
      gateContent = (
        <HardGateBlockingScreen stage={status} candidateId={profile.id} email={profile.email} />
      )
    }
  }

  return (
    <div className="min-h-screen">
      <IdentifyUser candidateId={profile.id} email={profile.email} />
      <HashScrollFix />
      <Suspense
        fallback={
          <DashboardNav
            portfolioAssetCount={0}
            supportNetworkUnreadCount={0}
            messagesUnreadCount={0}
            newBackchannelCount={0}
          />
        }
      >
        <DashboardNavWithBadges profileId={profile.id} />
      </Suspense>
      {/* pb-24 clears the fixed mobile bottom tab bar (Prompt 83) — lg:pb-12
          reverts to the normal bottom spacing once that bar is hidden.
          min-h-screen keeps this white all the way to the bottom of the
          viewport on short pages (e.g. the loading skeleton) — without it,
          the body's own --background (a light gray-blue, see globals.css)
          shows through below wherever this element's content ends. */}
      <main className="min-h-screen bg-white px-6 pt-12 pb-24 lg:pb-12 lg:pl-[calc(18rem+1.5rem)]">
        <div className="mx-auto max-w-4xl">{gateContent ?? children}</div>
      </main>
    </div>
  )
}
