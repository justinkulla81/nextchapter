import { RetuneHost } from '@/components/dashboard/RetuneMoment'
import { CandidatePlusUnlockLoader } from '@/components/dashboard/CandidatePlusUnlockLoader'
import type { Metadata } from 'next'
import { accessFor } from '@/lib/access/grants'
import { Suspense } from 'react'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import { CollegeBar } from '@/components/higher-ed/CollegeBar'
import { ProgramBar } from '@/components/dashboard/ProgramBar'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { countOpenRequestsForCandidate } from '@/lib/documents/requests'
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
import { earlyCareerAudience } from '@/lib/early-career/audience'
import { isInWorkMember } from '@/lib/in-work/constants'
import { getFreshJobsPeek } from '@/lib/jobs/fresh-jobs-peek'
import { timed } from '@/lib/perf/timed'
import { PlaceTabs } from '@/components/dashboard/PlaceTabs'
import { RedesignNav } from '@/components/dashboard/RedesignNav'
import { RedesignParts } from '@/components/dashboard/RedesignParts'
import { isRedesignOn } from '@/lib/redesign/flag'
import { JourneyCheckInDialog } from '@/components/dashboard/JourneyCheckInDialog'
import { checkInDue, effectiveJourney, effectiveStage, getStage } from '@/lib/journey/journey'
import { menuMode } from '@/lib/journey/menu'

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
    freshJobsCount,
    documentRequestCount,
    profile,
  ] = await Promise.all([
    timed('layout', 'supportNetworkUnread', profileId, getSupportNetworkUnreadCountForBadge(profileId)),
    timed('layout', 'candidateUnread', profileId, getCandidateUnreadCount(profileId)),
    timed('layout', 'peerUnread', profileId, getPeerUnreadCount(profileId)),
    timed('layout', 'needsFollowUp', profileId, getNeedsFollowUpList(profileId)),
    timed('layout', 'gmailConnected', profileId, isGmailConnected(profileId)),
    timed('layout', 'helpReplies', profileId, getHelpRepliesWaiting(profileId)),
    timed('layout', 'freshJobs', profileId, getFreshJobsCountForBadge()),
    timed('layout', 'documentRequests', profileId, countOpenRequestsForCandidate(profileId)),
    getDashboardProfile(),
  ])
  // One badge per place. Network adds up its three live signals: people to
  // follow up with, unread messages, and unread community posts.
  const messagesUnreadCount = candidateMessagesUnreadCount + peerUnreadCount
  const needsFollowUpCount = needsFollowUpList.length

  if (isRedesignOn(profile.email)) {
    const access = await accessFor(profileId)
    return (
      <>
        <RedesignNav
          badges={{ jobs: freshJobsCount, network: needsFollowUpCount + messagesUnreadCount + supportNetworkUnreadCount, help: helpRepliesWaiting, account: documentRequestCount }}
          employed={isInWorkMember(profile)}
          earlyCareer={earlyCareerAudience(profile) !== null}
          // The redesign does not lock tabs behind connecting Gmail: connecting is offered where it helps, never required.
          locks={{ hasEmailConnection: true, skillsAssessmentCompleted: profile.skillsAssessmentCompletedAt !== null, mode: menuMode(effectiveStage(profile), effectiveJourney(profile)) }}
          paidAccess={{ coaching: access.coaching.on, recruiters: access.recruiters.on }}
          moneyHelp={profile.moneyHelp}
        />
        <HelpFeedbackLauncher repliesWaiting={helpRepliesWaiting} />
      </>
    )
  }

  return (
    <>
    <DashboardNav
      badges={{
        jobs: freshJobsCount,
        network: needsFollowUpCount + messagesUnreadCount + supportNetworkUnreadCount,
        help: helpRepliesWaiting,
        personalize: documentRequestCount,
      }}
      hasEmailConnection={gmailConnected}
      skillsAssessmentCompleted={profile.skillsAssessmentCompletedAt !== null}
      employed={isInWorkMember(profile)}
      mode={menuMode(effectiveStage(profile), effectiveJourney(profile))}
    />
    {/* Help & feedback, in the corner of every portal page. */}
    <HelpFeedbackLauncher repliesWaiting={helpRepliesWaiting} />
    </>
  )
}

// New jobs in the member's field from the last 72 hours: one small query (fresh-jobs-peek.ts),
// never the whole board. The badge is decoration: any error reads as "nothing new".
async function getFreshJobsCountForBadge(): Promise<number> {
  const profile = await getDashboardProfile()
  return (await getFreshJobsPeek(profile.primaryFunction, profile.secondaryFunction)).count
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
  if (prompt) return <CheckInPromptDialog {...prompt} />
  // Nothing else is due, so ask "Still searching?" at the stage's pace. Never
  // two pop-ups at once.
  const profile = await getDashboardProfile()
  const stage = effectiveStage(profile)
  if (!stage || stage === 'PAUSED' || !checkInDue(profile)) return null
  return <JourneyCheckInDialog stageLabel={getStage(stage).label} />
}

// The place tab row needs the connection flags to show the right locks and a
// live count for the documents badge; its own boundary keeps those queries off the
// page's critical path. No Companies badge here: counting "new strong companies" ranked
// the whole directory and every live posting (a second copy of the board) on every
// page view, and ran instances out of memory.
async function PlaceTabsWithLocks({ profileId }: { profileId: string }) {
  const [profile, gmailConnected, access, documentRequests] = await Promise.all([
    getDashboardProfile(),
    isGmailConnected(profileId),
    accessFor(profileId),
    countOpenRequestsForCandidate(profileId),
  ])
  return (
    <PlaceTabs
      employed={isInWorkMember(profile)}
      earlyCareer={earlyCareerAudience(profile) !== null}
      locks={{ hasEmailConnection: gmailConnected, skillsAssessmentCompleted: profile.skillsAssessmentCompletedAt !== null, mode: menuMode(effectiveStage(profile), effectiveJourney(profile)) }}
      paidAccess={{ coaching: access.coaching.on, recruiters: access.recruiters.on }}
      tabBadges={{ '/dashboard/documents': documentRequests }}
    />
  )
}

// The redesigned part switches (Jobs, Not posted yet, ...), with the same locks as the tab row.
async function RedesignPartsWithLocks({ profileId }: { profileId: string }) {
  const [profile, access] = await Promise.all([getDashboardProfile(), accessFor(profileId)])
  return (
    <RedesignParts
      employed={isInWorkMember(profile)}
      earlyCareer={earlyCareerAudience(profile) !== null}
      locks={{ hasEmailConnection: true, skillsAssessmentCompleted: profile.skillsAssessmentCompletedAt !== null, mode: menuMode(effectiveStage(profile), effectiveJourney(profile)) }}
      paidAccess={{ coaching: access.coaching.on, recruiters: access.recruiters.on }}
      moneyHelp={profile.moneyHelp}
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

  const redesign = isRedesignOn(profile.email)
  const personName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'You'

  return (
    <div className={redesign ? 'theme-candidate theme-redesign min-h-screen' : 'theme-candidate min-h-screen'}>
      <IdentifyUser candidateId={profile.id} email={profile.email} />
      <DashboardActivityTracker />
      {/* "Retuning your search": shown after any save that changes matching, on whatever page it lands. */}
      <RetuneHost />
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
      {/* Outplacement: the employer's brand, when they enrolled this person and set a look. */}
      <Suspense fallback={null}>
        <ProgramBar candidateId={profile.id} className="lg:pl-[calc(18rem+1.5rem)]" />
      </Suspense>
      <Suspense
        fallback={
          <DashboardNav />
        }
      >
        <DashboardNavWithBadges profileId={profile.id} />
      </Suspense>
      {/* The one-time "Candidate+ unlocked" screen, with the member's own numbers. */}
      {hardGateStatus !== 'search_strategy_required' && (
        <Suspense fallback={null}>
          <CandidatePlusUnlockLoader profileId={profile.id} />
        </Suspense>
      )}
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
      <main className="nc-main min-h-screen bg-white px-6 pt-12 pb-24 lg:pb-12 lg:pl-[calc(18rem+1.5rem)]">
        <div className="nc-main-inner mx-auto max-w-4xl">
          <HardGateGate subjectToHardGate={profile.subjectToHardGate} status={hardGateStatus}>
            <Suspense fallback={null}>
              <GoogleConnectResultBanner />
            </Suspense>
            {redesign ? (
              <Suspense fallback={null}>
                <RedesignPartsWithLocks profileId={profile.id} />
              </Suspense>
            ) : (
              <Suspense
                fallback={<PlaceTabs employed={false} locks={{ hasEmailConnection: true, skillsAssessmentCompleted: true }} paidAccess={{ coaching: true, recruiters: true }} />}
              >
                <PlaceTabsWithLocks profileId={profile.id} />
              </Suspense>
            )}
            {children}
          </HardGateGate>
        </div>
      </main>
    </div>
  )
}
