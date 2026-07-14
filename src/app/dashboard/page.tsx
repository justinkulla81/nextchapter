import type { HireabilityReport } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { generateHireabilityReport } from '@/lib/reports/hireability-report'
import { sendHireabilityReportEmail } from '@/lib/email/send-hireability-report'
import { calculateEmployabilityScore, scoreToNextSteps } from '@/lib/scoring/employability-score'
import { getQuoteOfTheDay } from '@/lib/constants/quotes'
import { getOrCreateCoachConversation } from '@/lib/coach/get-conversation'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
import { getTodaysMood } from '@/lib/daily/mood'
import { getTodaysPrimaryAction } from '@/lib/daily/primary-action'
import { getCurrentWeekSprint, hasStartedSprint, type CommittedAction } from '@/lib/weekly/sprint'
import { computeUnlockTierForCandidate } from '@/lib/community/unlock-tier'
import { computeEarnedBadges } from '@/lib/community/badges'
import { getCommunityFeed } from '@/lib/community/community-feed'
import { isAtOrBelowGrade } from '@/lib/coaching/grade-threshold'
import { getWeek1Artifacts } from '@/lib/sprint/week1'
import { getGoalLabel } from '@/lib/scoring/goal-label'
import { CompactGradeCard } from '@/components/dashboard/CompactGradeCard'
import { MoodCheckInCard } from '@/components/dashboard/MoodCheckInCard'
import { SuccessSprintCard } from '@/components/dashboard/SuccessSprintCard'
import { Week1ArtifactSprint } from '@/components/dashboard/Week1ArtifactSprint'
import { CommunityTierCard } from '@/components/dashboard/CommunityTierCard'
import { CommunityPreviewWidget } from '@/components/dashboard/CommunityPreviewWidget'
import { CoachingCTACard } from '@/components/dashboard/CoachingCTACard'
import { GotHiredCTACard } from '@/components/dashboard/GotHiredCTACard'
import type { ActionDay } from '@/lib/daily/primary-action'
import { CoachChatCard } from '@/components/dashboard/CoachChatCard'
import { EmailConfirmationBanner } from '@/components/dashboard/EmailConfirmationBanner'
import { WorkStyleProfileCard } from '@/components/dashboard/WorkStyleProfileCard'
import { NextStepsList } from '@/components/candidates/NextStepsList'
import type { DimensionVectors } from '@/lib/scoring/assessment-vectors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Resolves the candidate's latest report, generating it on demand if the
// registration-time background job hasn't produced one yet, and sending the
// report email if it hasn't gone out — see the comment at its call site.
async function resolveLatestReport(
  candidateId: string,
  existingReport: HireabilityReport | undefined
): Promise<HireabilityReport | undefined> {
  let latestReport = existingReport
  if (!latestReport) {
    try {
      await generateHireabilityReport(candidateId)
      latestReport =
        (await prisma.hireabilityReport.findFirst({
          where: { candidateId },
          orderBy: { generatedAt: 'desc' },
        })) ?? undefined
    } catch (error) {
      console.error('Failed to generate hireability report on demand:', error)
    }
  }
  if (latestReport && !latestReport.emailSentAt) {
    await sendHireabilityReportEmail(candidateId)
  }
  return latestReport
}

export default async function DashboardPage() {
  const profile = await getDashboardData()
  const supabase = await createClient()
  const quote = getQuoteOfTheDay()

  // All of these are independent of one another — issuing them together
  // instead of one-by-one turns ~9 sequential round trips into one parallel
  // batch, which is where most of this page's load time was going.
  const [
    {
      data: { user },
    },
    currentRaw,
    conversation,
    grade,
    todaysMood,
    currentSprint,
    unlockTier,
    earnedBadges,
    searchExecutionAvailable,
    latestReport,
    communityFeed,
    narrative,
    outreachCount,
    existingBountyClaimCount,
  ] = await Promise.all([
    supabase.auth.getUser(),
    calculateEmployabilityScore(profile.id),
    getOrCreateCoachConversation(profile.id),
    computeHireabilityGrade(profile),
    getTodaysMood(profile.id),
    getCurrentWeekSprint(profile.id),
    computeUnlockTierForCandidate(profile.id),
    computeEarnedBadges(profile.id),
    hasStartedSprint(profile.id),
    // The registration-time after() callback that normally generates AND
    // emails the first report can get cut off by the platform's function
    // duration before the email step ever runs, leaving a real, generated
    // report permanently unsent. This closes that gap on every load, not
    // just the first, and also covers the case where that background job
    // never even finished generating the report at all.
    resolveLatestReport(profile.id, profile.hireabilityReports[0]),
    getCommunityFeed(3),
    prisma.candidateNarrative.findUnique({ where: { candidateId: profile.id } }),
    prisma.outreachLog.count({ where: { candidateId: profile.id } }),
    prisma.bountyClaim.count({ where: { candidateId: profile.id } }),
  ])

  const weekNumber = profile._count.weeklySprints + 1
  const isFirstWeek = weekNumber === 1

  const nextSteps = scoreToNextSteps(profile, currentRaw)
  const latestAssessment = profile.assessmentResponses[0]
  const primaryAction = latestReport
    ? getTodaysPrimaryAction(latestReport.actionPlan as unknown as ActionDay[], latestReport.generatedAt)
    : null

  const daysSinceRegistration = profile.registrationCompletedAt
    ? (new Date().getTime() - profile.registrationCompletedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 0
  const dayNumber = Math.floor(daysSinceRegistration) + 1
  const goalLabel = getGoalLabel(profile.currentJobStatus)
  const showCoachingCTA = daysSinceRegistration >= 7 && isAtOrBelowGrade(grade.searchExecution.grade, 'C')

  const week1Artifacts = getWeek1Artifacts({
    linkedInPosted: profile.linkedInActivityLogs.length > 0,
    coverLetterGenerated: profile.jobPostings.some((j) => !!j.coverLetter),
    narrativeGenerated: !!narrative,
    outreachLogged: outreachCount > 0,
  })

  const showGotHiredCTA = weekNumber >= 2 && existingBountyClaimCount === 0

  return (
    <div className="space-y-8">
      {user && !user.email_confirmed_at && user.email && (
        <EmailConfirmationBanner email={user.email} />
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hireability Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Week {weekNumber} &middot; Day {dayNumber} — Your goal is to {goalLabel}.
        </p>
      </div>

      <MoodCheckInCard
        quote={quote}
        todaysMood={todaysMood}
        currentStreak={profile.currentStreak}
        primaryAction={primaryAction}
        firstName={profile.firstName}
      />

      <CommunityPreviewWidget feed={communityFeed} />

      {isFirstWeek ? (
        <Week1ArtifactSprint artifacts={week1Artifacts} />
      ) : (
        <SuccessSprintCard
          actions={currentSprint ? (currentSprint.committedActions as unknown as CommittedAction[]) : null}
        />
      )}

      <CompactGradeCard grade={grade} searchExecutionAvailable={searchExecutionAvailable} />

      <Card>
        <CardContent className="pt-6">
          <NextStepsList nextSteps={nextSteps} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Your Work Style Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latestAssessment ? (
            <WorkStyleProfileCard
              dimensionVectors={latestAssessment.dimensionVectors as unknown as DimensionVectors}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                A quick, optional assessment of how you prefer to work — helps us (and your
                references) understand what makes you thrive, not just what you can do.
              </p>
              <a
                href="/onboarding/working-style"
                className="inline-block text-sm font-medium text-primary underline underline-offset-4"
              >
                Take the Work Style Assessment
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <CommunityTierCard tier={unlockTier} badges={earnedBadges} />

      {showGotHiredCTA && <GotHiredCTACard />}

      {showCoachingCTA && <CoachingCTACard />}

      <CoachChatCard initialMessages={conversation.messages} />
    </div>
  )
}
