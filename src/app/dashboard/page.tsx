import type { HireabilityReport } from '@prisma/client'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { generateHireabilityReport } from '@/lib/reports/hireability-report'
import { sendHireabilityReportEmail } from '@/lib/email/send-hireability-report'
import { getOrCreateCoachConversation } from '@/lib/coach/get-conversation'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
import { getTodaysConnectionAction } from '@/lib/daily/connection-action'
import {
  getCurrentWeekSprint,
  getSuggestedActions,
  getMondayOfWeek,
  hasStartedSprint,
  type CommittedAction,
} from '@/lib/weekly/sprint'
import { isSprintEditWindowOpen } from '@/lib/weekly/pt-time'
import { isAtOrBelowGrade } from '@/lib/coaching/grade-threshold'
import { getWeek1Artifacts } from '@/lib/sprint/week1'
import { getGoalLabel } from '@/lib/scoring/goal-label'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { getNextDashboardMessage } from '@/lib/dashboard/messages'
import { DashboardTopStrip } from '@/components/dashboard/DashboardTopStrip'
import { ConnectionActionCard } from '@/components/dashboard/ConnectionActionCard'
import { SuccessSprintCard } from '@/components/dashboard/SuccessSprintCard'
import { Week1ArtifactSprint } from '@/components/dashboard/Week1ArtifactSprint'
import { DashboardMessageCard } from '@/components/dashboard/DashboardMessageCard'
import { CoachingCTACard } from '@/components/dashboard/CoachingCTACard'
import { GotHiredCTACard } from '@/components/dashboard/GotHiredCTACard'
import { CoachChatCard } from '@/components/dashboard/CoachChatCard'
import { SessionImpactCard } from '@/components/dashboard/SessionImpactCard'
import { getUnviewedSessionImpact } from '@/lib/coach/session-impact'
import { EmailConfirmationBanner } from '@/components/dashboard/EmailConfirmationBanner'
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
  const weekNumber = profile._count.weeklySprints + 1
  const isFirstWeek = weekNumber === 1
  const weekStartDate = getMondayOfWeek(new Date())
  const editWindowOpen = isSprintEditWindowOpen(weekStartDate)

  // All of these are independent of one another — issuing them together
  // instead of one-by-one turns ~9 sequential round trips into one parallel
  // batch, which is where most of this page's load time was going.
  const [
    {
      data: { user },
    },
    conversation,
    grade,
    currentSprint,
    suggestedActions,
    searchExecutionAvailable,
    ,
    narrative,
    outreachCount,
    existingBountyClaimCount,
    sessionImpact,
    dashboardMessage,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getOrCreateCoachConversation(profile.id),
    computeHireabilityGrade(profile),
    getCurrentWeekSprint(profile.id),
    isFirstWeek ? Promise.resolve([]) : getSuggestedActions(profile.id, weekNumber),
    hasStartedSprint(profile.id),
    // The registration-time after() callback that normally generates AND
    // emails the first report can get cut off by the platform's function
    // duration before the email step ever runs, leaving a real, generated
    // report permanently unsent. This closes that gap on every load, not
    // just the first, and also covers the case where that background job
    // never even finished generating the report at all.
    resolveLatestReport(profile.id, profile.hireabilityReports[0]),
    prisma.candidateNarrative.findUnique({ where: { candidateId: profile.id } }),
    prisma.outreachLog.count({ where: { candidateId: profile.id } }),
    prisma.bountyClaim.count({ where: { candidateId: profile.id } }),
    getUnviewedSessionImpact(profile.id),
    getNextDashboardMessage(profile.id),
  ])

  const daysSinceRegistration = profile.registrationCompletedAt
    ? (new Date().getTime() - profile.registrationCompletedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 0
  const dayNumber = Math.floor(daysSinceRegistration) + 1
  const goalLabel = getGoalLabel(profile.currentJobStatus)
  const casuallySearching = isCasuallySearching(profile.jobSearchIntensity)
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
        <h1 className="text-2xl font-semibold tracking-tight">Success Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {casuallySearching
            ? `Your goal is to ${goalLabel.toLowerCase()} — whenever you're ready to prioritize it.`
            : `Your goal is to ${goalLabel}.`}
        </p>
      </div>

      <DashboardMessageCard message={dashboardMessage} />

      <DashboardTopStrip
        grade={grade}
        searchExecutionAvailable={searchExecutionAvailable}
        weekNumber={weekNumber}
        dayNumber={dayNumber}
      />

      <EmployerInterestSection candidateId={profile.id} />

      <div className="space-y-3">
        {isFirstWeek ? (
          <Week1ArtifactSprint artifacts={week1Artifacts} />
        ) : (
          <SuccessSprintCard
            actions={currentSprint ? (currentSprint.committedActions as unknown as CommittedAction[]) : null}
            suggestedActions={suggestedActions}
            marketRealityGrade={grade.marketReality.grade}
            weekNumber={weekNumber}
            editWindowOpen={editWindowOpen}
            weeklySprintsCount={profile._count.weeklySprints}
            engines={grade.searchExecution.engines}
            laggingEngines={grade.searchExecution.laggingEngines}
            categoryMinimumsMet={grade.searchExecution.categoryMinimumsMet}
          />
        )}
      </div>

      {(showGotHiredCTA || showCoachingCTA || sessionImpact) && (
        <div className="space-y-4">
          {showGotHiredCTA && <GotHiredCTACard />}
          {showCoachingCTA && <CoachingCTACard />}
          {sessionImpact && <SessionImpactCard report={sessionImpact} />}
        </div>
      )}

      <div className="space-y-4 border-t border-border pt-8">
        <ConnectionActionCard action={getTodaysConnectionAction(profile.id)} />
        <CoachChatCard initialMessages={conversation.messages} firstName={profile.firstName} />
      </div>
    </div>
  )
}
