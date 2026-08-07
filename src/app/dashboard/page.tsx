import type { HireabilityReport } from '@prisma/client'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { generateHireabilityReport } from '@/lib/reports/hireability-report'
import { claimReportGeneration } from '@/lib/reports/report-generation-lock'
import { sendHireabilityReportEmail } from '@/lib/email/send-hireability-report'
import { getOrCreateCoachConversation } from '@/lib/coach/get-conversation'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { getTodaysMood, getCheckInSummary, startOfUTCDay, getSentimentAlert } from '@/lib/daily/mood'
import { SentimentSupportCard } from '@/components/dashboard/SentimentSupportCard'
import {
  getCurrentWeekSprint,
  getSuggestedActions,
  getMondayOfWeek,
  getCandidateWeekNumber,
  hasStartedSprint,
  type CommittedAction,
} from '@/lib/weekly/sprint'
import { getMoodCardIdeas } from '@/lib/weekly/action-effort'
import { isAtOrBelowGrade } from '@/lib/coaching/grade-threshold'
import { DashboardTopStrip } from '@/components/dashboard/DashboardTopStrip'
import { MoodCheckInCard } from '@/components/dashboard/MoodCheckInCard'
import { SuccessSprintCard } from '@/components/dashboard/SuccessSprintCard'
import { getProfileChecklistItems } from '@/lib/weekly/profile-checklist'
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

// Resolves the candidate's latest report, generating it on demand if the
// registration-time background job hasn't produced one yet, and sending the
// report email if it hasn't gone out — see the comment at its call site.
async function resolveLatestReport(
  candidateId: string,
  existingReport: HireabilityReport | undefined
): Promise<HireabilityReport | undefined> {
  let latestReport = existingReport
  if (!latestReport) {
    // Only proceed if we win the claim — otherwise another invocation is
    // already generating (or just generated) this candidate's report, so
    // re-fetch instead of generating a duplicate.
    if (await claimReportGeneration(candidateId)) {
      try {
        await generateHireabilityReport(candidateId)
      } catch (error) {
        console.error('Failed to generate hireability report on demand:', error)
      }
    }
    latestReport =
      (await prisma.hireabilityReport.findFirst({
        where: { candidateId },
        orderBy: { generatedAt: 'desc' },
      })) ?? undefined
  }
  if (latestReport && !latestReport.emailSentAt) {
    await sendHireabilityReportEmail(candidateId)
  }
  return latestReport
}

export default async function DashboardPage() {
  const profile = await getDashboardData()
  const supabase = await createClient()

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
  after(() => resolveLatestReport(profile.id, profile.hireabilityReports[0]))

  const weekStartDate = getMondayOfWeek(new Date())
  const weekNumber = await getCandidateWeekNumber(profile.id, weekStartDate)

  // All of these are independent of one another — issuing them together
  // instead of one-by-one turns ~9 sequential round trips into one parallel
  // batch, which is where most of this page's load time was going.
  const [
    {
      data: { user },
    },
    conversation,
    grade,
    todaysMood,
    checkInSummary,
    currentSprint,
    suggestedActions,
    searchExecutionAvailable,
    existingBountyClaimCount,
    sessionImpact,
    hasCoachingFormResponse,
    sentimentAlert,
    profileChecklistItems,
    emailConnection,
    calendarConnection,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getOrCreateCoachConversation(profile.id, profile.firstName),
    computeHireabilityGrade(profile),
    getTodaysMood(profile.id),
    getCheckInSummary(profile.id),
    getCurrentWeekSprint(profile.id),
    getSuggestedActions(profile.id, weekNumber),
    hasStartedSprint(profile.id),
    prisma.bountyClaim.count({ where: { candidateId: profile.id } }),
    getUnviewedSessionImpact(profile.id),
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
  ])
  const needsCoachingForm = !!profile.coachId && !!profile.coachDossierConsentedAt && !hasCoachingFormResponse

  const todaysIdeas = getMoodCardIdeas(
    currentSprint ? (currentSprint.committedActions as unknown as CommittedAction[]) : null,
    3,
    todaysMood
  )

  // Prompt 45 §8: on_track is measured against the system's points_target
  // (the ramp), never against whatever the candidate personally committed
  // to — those are different numbers and only points_target should decide
  // pacing.
  const daysElapsedThisWeek = Math.min(
    7,
    Math.max(1, Math.floor((new Date().getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  )
  const onTrack = grade.weeklyPoints > (grade.weeklyPointsTarget * daysElapsedThisWeek) / 7

  const daysSinceRegistration = profile.registrationCompletedAt
    ? (new Date().getTime() - profile.registrationCompletedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 0
  const dayNumber = Math.floor(daysSinceRegistration) + 1
  const showCoachingCTA = daysSinceRegistration >= 7 && isAtOrBelowGrade(grade.grade, 'C')

  const showGotHiredCTA = weekNumber >= 2 && existingBountyClaimCount === 0

  const moodCardDismissedToday =
    profile.moodCardDismissedAt !== null && profile.moodCardDismissedAt >= startOfUTCDay()

  return (
    <div className="space-y-8">
      {user && !user.email_confirmed_at && user.email && (
        <EmailConfirmationBanner email={user.email} />
      )}
      <PendingEmployerReferenceBanner candidateEmail={user?.email ?? null} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Success Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          NextChapter&apos;s goal is to get you a job. Let&apos;s go!
        </p>
      </div>

      <DashboardTopStrip
        grade={grade}
        searchExecutionAvailable={searchExecutionAvailable}
        currentStreak={checkInSummary.streak}
        weekNumber={weekNumber}
        dayNumber={dayNumber}
        suppressUrgency={isCasuallySearching(profile.jobSearchDifficultyLevel, profile.searchIntensity)}
      />

      <PageHeaderBoxes pageKey="dashboard" candidateId={profile.id} />

      <EmployerInterestSection candidateId={profile.id} />

      <div className="space-y-3">
        <MoodCheckInCard
          todaysMood={todaysMood}
          currentStreak={checkInSummary.streak}
          checkInsLast7Days={checkInSummary.checkInsLast7Days}
          isConsecutive={checkInSummary.isConsecutive}
          todaysIdeas={todaysIdeas}
          firstName={profile.firstName}
          dismissedToday={moodCardDismissedToday}
        />

        <VisibilityComfortCard initialComfort={currentSprint?.visibilityComfort ?? null} />

        <ReconnectBanner candidateId={profile.id} variant="link" />

        <SuccessSprintCard
          actions={currentSprint ? (currentSprint.committedActions as unknown as CommittedAction[]) : null}
          suggestedActions={suggestedActions}
          weeklySprintsCount={profile._count.weeklySprints}
          engines={grade.weeklyEngines}
          laggingEngines={grade.laggingEngines}
          categoryMinimumsMet={grade.categoryMinimumsMet}
          weeklyPoints={grade.weeklyPoints}
          weeklyPointsTarget={grade.weeklyPointsTarget}
          weeklyVisibilityBonus={grade.weeklyVisibilityBonus}
          onTrack={onTrack}
          hasEmailConnection={!!emailConnection}
          hasCalendarConnection={!!calendarConnection}
          profileChecklistItems={profileChecklistItems}
        />
      </div>

      {sentimentAlert.lowSentiment && <SentimentSupportCard hasCoach={!!profile.coachId} />}

      {(showGotHiredCTA || sessionImpact || needsCoachingForm) && (
        <div className="space-y-4">
          {showGotHiredCTA && <GotHiredCTACard />}
          {sessionImpact && <SessionImpactCard report={sessionImpact} />}
          {needsCoachingForm && <CoachingFormReminderCard />}
        </div>
      )}

      <div className="space-y-4 border-t border-border pt-8">
        <CoachChatCard initialMessages={conversation.messages} showExecutiveCoachCta={showCoachingCTA} />
      </div>
    </div>
  )
}
