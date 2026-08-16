import type { MarketRealityReport } from '@prisma/client'
import { Suspense } from 'react'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { generateMarketRealityReport } from '@/lib/reports/market-reality-report'
import { claimReportGeneration } from '@/lib/reports/report-generation-lock'
import { sendMarketRealityReportEmail } from '@/lib/email/send-market-reality-report'
import { getOrCreateCoachConversation } from '@/lib/coach/get-conversation'
import { computeWeeklyProgress } from '@/lib/weekly/weekly-engines'
import { computeMarketRealityCompositeGrade } from '@/lib/scoring/market-reality/composite'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { getTodaysMood, getCheckInSummary, startOfUTCDay, getSentimentAlert } from '@/lib/daily/mood'
import { SentimentSupportCard } from '@/components/dashboard/SentimentSupportCard'
import { evaluatePassiveToActivePrompt } from '@/lib/dashboard/passive-to-active-prompt'
import { PassiveToActivePromptCard } from '@/components/dashboard/PassiveToActivePromptCard'
import {
  getCurrentWeekSprint,
  getSuggestedActions,
  getMondayOfWeek,
  getCandidateWeekNumber,
  hasStartedSprint,
  type CommittedAction,
} from '@/lib/weekly/sprint'
import { isAtOrBelowGrade } from '@/lib/coaching/grade-threshold'
import { DashboardTopStrip, DashboardTopStripSkeleton } from '@/components/dashboard/DashboardTopStrip'
import { MoodCheckInCard } from '@/components/dashboard/MoodCheckInCard'
import { SuccessSprintCard } from '@/components/dashboard/SuccessSprintCard'
import { WeeklyFocusCard, WeeklyFocusSkeleton } from '@/components/dashboard/WeeklyFocusCard'
import { getProfileChecklistItems } from '@/lib/weekly/profile-checklist'
import { computeSearchStrategyChecklist } from '@/lib/weekly/search-strategy-checklist'
import { inferIndustriesFromWorkHistory } from '@/lib/onboarding/infer-industries'
import { VisibilityComfortCard } from '@/components/dashboard/VisibilityComfortCard'
import { ReconnectBanner } from '@/components/dashboard/ReconnectBanner'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { GotHiredCTACard } from '@/components/dashboard/GotHiredCTACard'
import { CoachChatCard } from '@/components/dashboard/CoachChatCard'
import { SessionImpactCard } from '@/components/dashboard/SessionImpactCard'
import { getUnviewedSessionImpact } from '@/lib/coach/session-impact'
import { hasSubmittedCoachingOnboardingForm } from '@/lib/coach/onboarding-form'
import { CoachingFormReminderCard } from '@/components/dashboard/CoachingFormReminderCard'
import { EmailConfirmationBanner } from '@/components/dashboard/EmailConfirmationBanner'
import { PendingEmployerReferenceBanner } from '@/components/dashboard/PendingEmployerReferenceBanner'
import { EmployerInterestSection } from '@/components/dashboard/EmployerInterestSection'
import { PortfolioAccessRequestSection } from '@/components/dashboard/PortfolioAccessRequestSection'
import { GuideCallout } from '@/components/dashboard/GuideCallout'
import { getNeedsFollowUpList } from '@/lib/network/needs-follow-up'
import { getEmailReminders } from '@/lib/network/reminders'
import { DashboardNetworkCard } from '@/components/dashboard/DashboardNetworkCard'
import { ActivationChecklistCard } from '@/components/dashboard/ActivationChecklistCard'
import { getHardGateStatus } from '@/lib/dashboard/access-gate'
import { SearchPlanCard } from '@/components/dashboard/SearchPlanCard'
import type { ApplicationTrendsResult } from '@/lib/network/application-trends'

// Resolves the candidate's latest report, generating it on demand if the
// registration-time background job hasn't produced one yet, and sending the
// report email if it hasn't gone out — see the comment at its call site.
async function resolveLatestReport(
  candidateId: string,
  existingReport: MarketRealityReport | undefined
): Promise<MarketRealityReport | undefined> {
  let latestReport = existingReport
  if (!latestReport) {
    // Only proceed if we win the claim — otherwise another invocation is
    // already generating (or just generated) this candidate's report, so
    // re-fetch instead of generating a duplicate.
    if (await claimReportGeneration(candidateId)) {
      try {
        await generateMarketRealityReport(candidateId)
      } catch (error) {
        console.error('Failed to generate market reality report on demand:', error)
      }
    }
    latestReport =
      (await prisma.marketRealityReport.findFirst({
        where: { candidateId },
        orderBy: { generatedAt: 'desc' },
      })) ?? undefined
  }
  if (latestReport && !latestReport.emailSentAt) {
    await sendMarketRealityReportEmail(candidateId)
  }
  return latestReport
}

// getUnviewedSessionImpact makes a live, uncached Anthropic call (unlike
// computeDossierCompetencies's market/company-size lookups, this one has no
// self-cache — it's a genuine "show this exact summary once" read, gated on
// marking the session viewed in the same call) whenever a candidate has an
// unviewed coach session from the last 7 days. Isolated in its own Suspense
// boundary so it never blocks the rest of the dashboard, which is otherwise
// all fast Prisma reads.
async function SessionImpactSection({ candidateId }: { candidateId: string }) {
  const sessionImpact = await getUnviewedSessionImpact(candidateId)
  if (!sessionImpact) return null
  return <SessionImpactCard report={sessionImpact} />
}

export default async function DashboardPage() {
  const profile = await getDashboardData()
  const supabase = await createClient()
  const completedReferencesCount = profile.references.filter((r) => r.status === 'COMPLETED').length

  // The registration-time after() callback in getDashboardData that
  // normally generates AND emails the first report can get cut off by the
  // platform's function duration before the email step ever runs, leaving
  // a real, generated report permanently unsent. This closes that gap on
  // every load, not just the first, and also covers the case where that
  // background job never even finished generating the report at all.
  // Deferred via after() rather than awaited inline — report generation
  // (an LLM call plus external market-data lookups) is unbounded and must
  // never be able to time out the page itself; nothing on this page reads
  // its result.
  after(() => resolveLatestReport(profile.id, profile.marketRealityReports[0]))

  const weekStartDate = getMondayOfWeek(new Date())
  const weekNumber = await getCandidateWeekNumber(profile.id, weekStartDate)
  const isMonday = new Date().getUTCDay() === 1

  // All of these are independent of one another — issuing them together
  // instead of one-by-one turns ~9 sequential round trips into one parallel
  // batch, which is where most of this page's load time was going.
  const [
    {
      data: { user },
    },
    conversation,
    weeklyProgress,
    marketRealityGrade,
    todaysMood,
    checkInSummary,
    currentSprint,
    suggestedActions,
    searchExecutionAvailable,
    existingBountyClaimCount,
    hasCoachingFormResponse,
    sentimentAlert,
    profileChecklistItems,
    emailConnection,
    calendarConnection,
    needsFollowUp,
    priorityContacts,
    passiveToActivePrompt,
    learningBadgeCount,
    outreachLogCount,
    interimSignupCount,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getOrCreateCoachConversation(profile.id, profile.firstName),
    computeWeeklyProgress(profile.id, weekNumber, profile.privacyTier, profile.confidentialSearchMode),
    computeMarketRealityCompositeGrade(profile.id),
    getTodaysMood(profile.id),
    getCheckInSummary(profile.id),
    getCurrentWeekSprint(profile.id),
    getSuggestedActions(profile.id, weekNumber),
    hasStartedSprint(profile.id),
    prisma.bountyClaim.count({ where: { candidateId: profile.id } }),
    // Prompt 60 — passive fallback for candidates whose consent was granted
    // before this feature existed (or who navigated away before completing
    // the form); the explicit redirects at consent-grant time are the
    // primary path, this just catches anyone who slips past them.
    profile.coachId && profile.coachDossierConsentedAt
      ? hasSubmittedCoachingOnboardingForm(profile.id)
      : Promise.resolve(true),
    getSentimentAlert(profile.id),
    getProfileChecklistItems(profile.id),
    prisma.emailConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null } }),
    prisma.calendarConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null } }),
    getNeedsFollowUpList(profile.id),
    getEmailReminders(profile.id),
    // §10-12 — read-only trigger check; PassiveToActivePromptCard records
    // "shown" itself once it actually renders (see that component).
    evaluatePassiveToActivePrompt(profile.id),
    // #931/#932 Search Plan — same simple counts each area's own page
    // already computes (learning/page.tsx's badges.length, network/page.tsx's
    // outreachLogs.length, interim-work/page.tsx's interimSignups.length),
    // re-queried here rather than threaded through props since this page
    // never otherwise fetches them.
    prisma.learningBadge.count({ where: { candidateId: profile.id } }),
    prisma.outreachLog.count({ where: { candidateId: profile.id } }),
    prisma.interimMarketplaceSignup.count({ where: { candidateId: profile.id } }),
  ])
  const needsCoachingForm = !!profile.coachId && !!profile.coachDossierConsentedAt && !hasCoachingFormResponse
  // Same recency sort + inference as search-strategy/page.tsx so this
  // checklist agrees with what that page actually shows — otherwise a
  // pre-filled-but-unsaved field (e.g. Target industries guessed from work
  // history) would read as "needs updating" here while looking already
  // answered there.
  const workHistoryByRecency = [...profile.workHistory].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
    return b.startDate.getTime() - a.startDate.getTime()
  })
  const inferredIndustries = inferIndustriesFromWorkHistory(workHistoryByRecency)
  const searchStrategyChecklist = computeSearchStrategyChecklist({ ...profile, inferredIndustries })

  // Prompt 45 §8: on_track is measured against the system's points_target
  // (the ramp), never against whatever the candidate personally committed
  // to — those are different numbers and only points_target should decide
  // pacing.
  const daysElapsedThisWeek = Math.min(
    7,
    Math.max(1, Math.floor((new Date().getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  )
  const onTrack = weeklyProgress.weeklyPoints > (weeklyProgress.weeklyPointsTarget * daysElapsedThisWeek) / 7

  // #931/#932 Search Plan — only shown once the candidate has cleared the
  // dashboard-wide hard gate (see access-gate.ts). Reuses emailConnection
  // (already fetched above) instead of a second isGmailConnected() query —
  // same "has a live, non-disconnected EmailConnection row" check either way.
  const hardGateStatus = getHardGateStatus(profile, !!emailConnection)

  // Same jobSearchPattern.applicationTrends read as find-my-job/page.tsx —
  // computed once at report-generation time, never recomputed live here.
  const totalApplications =
    (
      profile.marketRealityReports[0]?.jobSearchPattern as unknown as {
        applicationTrends: ApplicationTrendsResult | null
      } | null
    )?.applicationTrends?.totalApplications ?? 0

  const daysSinceRegistration = profile.registrationCompletedAt
    ? (new Date().getTime() - profile.registrationCompletedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 0
  const dayNumber = Math.floor(daysSinceRegistration) + 1
  const showCoachingCTA =
    daysSinceRegistration >= 7 && marketRealityGrade !== null && isAtOrBelowGrade(marketRealityGrade.grade, 'C')

  const showGotHiredCTA = weekNumber >= 2 && existingBountyClaimCount === 0

  const moodCardDismissedToday =
    profile.moodCardDismissedAt !== null && profile.moodCardDismissedAt >= startOfUTCDay()

  return (
    <div className="space-y-8">
      {user && !user.email_confirmed_at && user.email && (
        <EmailConfirmationBanner email={user.email} />
      )}
      <PendingEmployerReferenceBanner candidateEmail={user?.email ?? null} />

      {/* §12 "Unified dashboard" — activation items always at top, never
          locked, above everything else including the top strip. */}
      <ActivationChecklistCard candidateId={profile.id} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Success Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          NextChapter&apos;s goal is to get you a job. Let&apos;s go!
        </p>
      </div>

      <PageHeaderBoxes pageKey="dashboard" candidateId={profile.id} />

      <Suspense fallback={<DashboardTopStripSkeleton />}>
        <DashboardTopStrip
          candidateId={profile.id}
          weeklyProgress={weeklyProgress}
          marketRealityGrade={marketRealityGrade?.grade ?? null}
          searchExecutionAvailable={searchExecutionAvailable}
          currentStreak={checkInSummary.streak}
          weekNumber={weekNumber}
          dayNumber={dayNumber}
          suppressUrgency={isCasuallySearching(profile.jobSearchDifficultyLevel, profile.searchIntensity)}
          badgesLastSeenCount={profile.badgesLastSeenCount}
        />
      </Suspense>

      {/* #931/#932 "Search Plan" — the post-activation equivalent of
          ActivationChecklistCard above: once a candidate has cleared the
          hard gate, this is "here's your plan," shown before "here's this
          week's focus" (WeeklyFocusCard) below. Never shown while still
          gated (search_strategy_required/activation_required) —
          ActivationChecklistCard already owns that state, and duplicating
          its job here would be redundant. Also shown to 'exempt' candidates
          (pre-existing accounts grandfathered out of the hard gate itself,
          per access-gate.ts) — they already have unrestricted dashboard
          access today, so this is purely additive value for them, not a
          gate to clear; restricting it to literal 'unlocked' would hide it
          from nearly every candidate who signed up before the hard gate
          shipped. */}
      {(hardGateStatus === 'unlocked' || hardGateStatus === 'exempt') && (
        <SearchPlanCard
          completedReferencesCount={completedReferencesCount}
          learningBadgeCount={learningBadgeCount}
          outreachLogCount={outreachLogCount}
          totalApplications={totalApplications}
          interimSignupCount={interimSignupCount}
          linkedInActivityCount={profile.linkedInActivityLogs.length}
          laggingEngines={weeklyProgress.laggingEngines}
        />
      )}

      <EmployerInterestSection candidateId={profile.id} />
      <PortfolioAccessRequestSection candidateId={profile.id} />

      <Suspense fallback={<WeeklyFocusSkeleton />}>
        <WeeklyFocusCard candidateId={profile.id} isMonday={isMonday} />
      </Suspense>

      <div className="space-y-3">
        <MoodCheckInCard
          todaysMood={todaysMood}
          checkInsLast7Days={checkInSummary.checkInsLast7Days}
          firstName={profile.firstName}
          dismissedToday={moodCardDismissedToday}
        />

        <VisibilityComfortCard initialComfort={currentSprint?.visibilityComfort ?? null} />

        <ReconnectBanner candidateId={profile.id} variant="link" />

        <DashboardNetworkCard
          followUps={needsFollowUp}
          priorityContact={priorityContacts[0] ?? null}
        />

        <SuccessSprintCard
          actions={currentSprint ? (currentSprint.committedActions as unknown as CommittedAction[]) : null}
          suggestedActions={suggestedActions}
          weeklySprintsCount={profile._count.weeklySprints}
          engines={weeklyProgress.engines}
          laggingEngines={weeklyProgress.laggingEngines}
          categoryMinimumsMet={weeklyProgress.categoryMinimumsMet}
          weeklyPoints={weeklyProgress.weeklyPoints}
          weeklyPointsTarget={weeklyProgress.weeklyPointsTarget}
          onTrack={onTrack}
          hasEmailConnection={!!emailConnection}
          hasCalendarConnection={!!calendarConnection}
          profileChecklistItems={profileChecklistItems}
          searchStrategyChecklist={searchStrategyChecklist}
          completedReferencesCount={completedReferencesCount}
          weekStartDate={weekStartDate}
        />
      </div>

      {passiveToActivePrompt && <PassiveToActivePromptCard trigger={passiveToActivePrompt.trigger} />}

      {sentimentAlert.lowSentiment && <SentimentSupportCard hasCoach={!!profile.coachId} />}

      {(showGotHiredCTA || needsCoachingForm) && (
        <div className="space-y-4">
          {showGotHiredCTA && <GotHiredCTACard />}
          {needsCoachingForm && <CoachingFormReminderCard />}
        </div>
      )}

      <Suspense fallback={null}>
        <SessionImpactSection candidateId={profile.id} />
      </Suspense>

      <div className="space-y-4 border-t border-border pt-8">
        <CoachChatCard initialMessages={conversation.messages} showExecutiveCoachCta={showCoachingCTA} />
      </div>

      <GuideCallout pageSlot="dashboard" currentJobStatus={profile.currentJobStatus} />
    </div>
  )
}
