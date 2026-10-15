import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import { CollegeBar } from '@/components/higher-ed/CollegeBar'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getSupportNetworkUnreadCount } from '@/lib/community/unread-count'
import { getCandidateUnreadCount } from '@/lib/messaging/threads'
import { getPeerUnreadCount } from '@/lib/messaging/peer-threads'
import { IdentifyUser } from '@/lib/posthog/IdentifyUser'
import { DashboardActivityTracker } from '@/components/dashboard/DashboardActivityTracker'
import { getNeedsFollowUpList } from '@/lib/network/needs-follow-up'
import { HashScrollFix } from '@/components/dashboard/HashScrollFix'
import { getHardGateStatus, isGmailConnected } from '@/lib/dashboard/access-gate'
import { HardGateGate } from '@/components/dashboard/HardGateGate'
import { RoleContextBanner } from '@/components/auth/RoleContextBanner'
import { CheckInPromptDialog } from '@/components/dashboard/CheckInPromptDialog'
import { getCheckInPrompt } from '@/lib/daily/check-in-prompt'
import { HelpFeedbackLauncher } from '@/components/dashboard/HelpFeedbackLauncher'
import { getHelpRepliesWaiting } from '@/lib/help/unread'
import { GoogleConnectResultBanner } from '@/components/dashboard/GoogleConnectResultBanner'
import { countNewStrongCompanies } from '@/lib/companies/new-strong-companies'
import { isInWorkMember } from '@/lib/in-work/constants'
import { PlaceTabs } from '@/components/dashboard/PlaceTabs'

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
    supportNetworkUnreadCount,
    candidateMessagesUnreadCount,
    peerUnreadCount,
    needsFollowUpList,
    gmailConnected,
    helpRepliesWaiting,
    newStrongCompaniesCount,
    profile,
  ] = await Promise.all([
    getSupportNetworkUnreadCountForBadge(profileId),
    getCandidateUnreadCount(profileId),
    getPeerUnreadCount(profileId),
    getNeedsFollowUpList(profileId),
    isGmailConnected(profileId),
    getHelpRepliesWaiting(profileId),
    getNewStrongCompaniesCountForBadge(profileId),
    getDashboardProfile(),
  ])
  // One badge per place. Network adds up its three live signals: people to
  // follow up with, unread messages, and unread community posts.
  const messagesUnreadCount = candidateMessagesUnreadCount + peerUnreadCount
  const needsFollowUpCount = needsFollowUpList.length

  return (
    <>
    <DashboardNav
      badges={{
        jobs: newStrongCompaniesCount,
        network: needsFollowUpCount + messagesUnreadCount + supportNetworkUnreadCount,
        help: helpRepliesWaiting,
      }}
      hasEmailConnection={gmailConnected}
      skillsAssessmentCompleted={profile.skillsAssessmentCompletedAt !== null}
      employed={isInWorkMember(profile)}
    />
    {/* Help & feedback, in the corner of every portal page. */}
    <HelpFeedbackLauncher repliesWaiting={helpRepliesWaiting} />
    </>
  )
}

// The nav badge is decoration: a failure or slow first compute must never take
// the whole dashboard down, so any error reads as "no new signals".
async function getNewStrongCompaniesCountForBadge(profileId: string): Promise<number> {
  try {
    return await countNewStrongCompanies(profileId)
  } catch (error) {
    console.error('Failed to count new strong companies for nav badge:', error)
    return 0
  }
}

// getSupportNetworkUnreadCount needs a profile field beyond just the id
// (communityLastViewedAt) — a small wrapper so the Promise.all above can
// read the (cached) profile without threading an extra param through
// DashboardNavWithBadges' props.
async function getSupportNetworkUnreadCountForBadge(profileId: string) {
  const profile = await getDashboardProfile()
  return getSupportNetworkUnreadCount(profileId, profile.communityLastViewedAt)
}
// The check-in pop-up that opens with the app (a few times a week). Its own
// Suspense boundary, so the schedule check never holds up the page.
async function CheckInPromptLoader({ profileId }: { profileId: string }) {
  const prompt = await getCheckInPrompt(profileId).catch(() => null)
  return prompt ? <CheckInPromptDialog {...prompt} /> : null
}

// The place tab row needs two connection flags to show the right locks; its
// own boundary keeps those queries off the page's critical path.
async function PlaceTabsWithLocks({ profileId }: { profileId: string }) {
  const [profile, gmailConnected] = await Promise.all([getDashboardProfile(), isGmailConnected(profileId)])
  return (
    <PlaceTabs
      employed={isInWorkMember(profile)}
      locks={{ hasEmailConnection: gmailConnected, skillsAssessmentCompleted: profile.skillsAssessmentCompletedAt !== null }}
    />
  )
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getDashboardProfile()

  // Dashboard-wide hard gate (see access-gate.ts) — only ever applies to
  // candidates created after this shipped (profile.subjectToHardGate) and
  // only outside a small allowlist of routes (the gate's own required pages
  // + account-level pages that must always stay reachable). The exemption
  // check itself happens client-side in HardGateGate (usePathname(), not a
  // middleware-forwarded header) — see that component for why. Search
  // Strategy is the only thing this gate checks — Gmail/LinkedIn connection
  // is a separate, non-blocking, per-feature unlock (DashboardNav.tsx), not
  // a prerequisite to anything.
  const hardGateStatus = profile.subjectToHardGate ? getHardGateStatus(profile) : 'exempt'

  const personName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'You'

  return (
    <div className="theme-candidate min-h-screen">
      <IdentifyUser candidateId={profile.id} email={profile.email} />
      <DashboardActivityTracker />
      <HashScrollFix />
      {/* lg:pl matches DashboardNav's fixed w-72 sidebar (see DashboardNav.tsx)
          — without it, the sidebar paints over this banner's left edge on
          desktop and can hide the "Switch to →" button underneath it. */}
      <RoleContextBanner
        userId={profile.userId}
        currentRole="candidate"
        personName={personName}
        className="lg:pl-[calc(18rem+1.5rem)]"
      />
      {/* Higher Ed: the member's college brand, when they joined through one. */}
      <Suspense fallback={null}>
        <CollegeBar candidateId={profile.id} className="lg:pl-[calc(18rem+1.5rem)]" />
      </Suspense>
      <Suspense
        fallback={
          <DashboardNav />
        }
      >
        <DashboardNavWithBadges profileId={profile.id} />
      </Suspense>
      {/* Not over the Search Strategy gate: that screen has one job. */}
      {hardGateStatus !== 'search_strategy_required' && (
        <Suspense fallback={null}>
          <CheckInPromptLoader profileId={profile.id} />
        </Suspense>
      )}
      {/* pb-24 clears the fixed mobile bottom tab bar (Prompt 83) — lg:pb-12
          reverts to the normal bottom spacing once that bar is hidden.
          min-h-screen keeps this white all the way to the bottom of the
          viewport on short pages (e.g. the loading skeleton) — without it,
          the body's own --background (a light gray-blue, see globals.css)
          shows through below wherever this element's content ends. */}
      <main className="min-h-screen bg-white px-6 pt-12 pb-24 lg:pb-12 lg:pl-[calc(18rem+1.5rem)]">
        <div className="mx-auto max-w-4xl">
          <HardGateGate subjectToHardGate={profile.subjectToHardGate} status={hardGateStatus}>
            <Suspense fallback={null}>
              <GoogleConnectResultBanner />
            </Suspense>
            <Suspense
              fallback={<PlaceTabs employed={false} locks={{ hasEmailConnection: true, skillsAssessmentCompleted: true }} />}
            >
              <PlaceTabsWithLocks profileId={profile.id} />
            </Suspense>
            {children}
          </HardGateGate>
        </div>
      </main>
    </div>
  )
}
