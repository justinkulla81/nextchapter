import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { generateHireabilityReport } from '@/lib/reports/hireability-report'
import { calculateEmployabilityScore, scoreToNextSteps } from '@/lib/scoring/employability-score'
import { getQuoteOfTheDay } from '@/lib/constants/quotes'
import { getOrCreateCoachConversation } from '@/lib/coach/get-conversation'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
import { getTodaysMood } from '@/lib/daily/mood'
import { getTodaysPrimaryAction } from '@/lib/daily/primary-action'
import { getCurrentWeekSprint, hasStartedSprint, type CommittedAction } from '@/lib/weekly/sprint'
import { computeUnlockTierForCandidate } from '@/lib/community/unlock-tier'
import { computeEarnedBadges } from '@/lib/community/badges'
import { CompactGradeCard } from '@/components/dashboard/CompactGradeCard'
import { MoodCheckInCard } from '@/components/dashboard/MoodCheckInCard'
import { SuccessSprintCard } from '@/components/dashboard/SuccessSprintCard'
import { CommunityTierCard } from '@/components/dashboard/CommunityTierCard'
import { ActionPlanCard, type ActionDay } from '@/components/dashboard/ActionPlanCard'
import { CoachChatCard } from '@/components/dashboard/CoachChatCard'
import { EmailConfirmationBanner } from '@/components/dashboard/EmailConfirmationBanner'
import { WorkStyleProfileCard } from '@/components/dashboard/WorkStyleProfileCard'
import { NextStepsList } from '@/components/candidates/NextStepsList'
import type { DimensionVectors } from '@/lib/scoring/assessment-vectors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const profile = await getDashboardData()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const currentRaw = await calculateEmployabilityScore(profile.id)
  const nextSteps = scoreToNextSteps(profile, currentRaw)
  const quote = getQuoteOfTheDay()
  const conversation = await getOrCreateCoachConversation(profile.id)
  const grade = await computeHireabilityGrade(profile)

  let latestReport: (typeof profile.hireabilityReports)[number] | undefined = profile.hireabilityReports[0]
  // Normally generated as a fire-and-forget side effect the first time
  // getDashboardData() sees justRegistered — if that background job hasn't
  // finished yet (or failed silently), don't leave the action plan stuck on
  // "check back in a moment" forever; generate it directly, here.
  if (!latestReport) {
    try {
      await generateHireabilityReport(profile.id)
      latestReport =
        (await prisma.hireabilityReport.findFirst({
          where: { candidateId: profile.id },
          orderBy: { generatedAt: 'desc' },
        })) ?? undefined
    } catch (error) {
      console.error('Failed to generate hireability report on demand:', error)
    }
  }
  const latestAssessment = profile.assessmentResponses[0]

  const todaysMood = await getTodaysMood(profile.id)
  const primaryAction = latestReport
    ? getTodaysPrimaryAction(latestReport.actionPlan as unknown as ActionDay[], latestReport.generatedAt)
    : null
  const currentSprint = await getCurrentWeekSprint(profile.id)
  const [unlockTier, earnedBadges, searchExecutionAvailable] = await Promise.all([
    computeUnlockTierForCandidate(profile.id),
    computeEarnedBadges(profile.id),
    hasStartedSprint(profile.id),
  ])

  return (
    <div className="space-y-8">
      {user && !user.email_confirmed_at && user.email && (
        <EmailConfirmationBanner email={user.email} />
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hireability Dashboard</h1>
        <blockquote className="mt-2 text-muted-foreground italic">
          &ldquo;{quote.text}&rdquo;
          <footer className="mt-1 text-sm not-italic text-muted-foreground/80">— {quote.author}</footer>
        </blockquote>
      </div>

      <MoodCheckInCard
        todaysMood={todaysMood}
        currentStreak={profile.currentStreak}
        primaryAction={primaryAction}
        firstName={profile.firstName}
      />

      <SuccessSprintCard
        actions={currentSprint ? (currentSprint.committedActions as unknown as CommittedAction[]) : null}
      />

      <CompactGradeCard grade={grade} searchExecutionAvailable={searchExecutionAvailable} />

      <Card>
        <CardContent className="pt-6">
          <NextStepsList nextSteps={nextSteps} />
        </CardContent>
      </Card>

      {todaysMood ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Your 7-day action plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestReport ? (
              <ActionPlanCard
                actionPlan={latestReport.actionPlan as unknown as ActionDay[]}
                networkingListDone={profile.networkingListSubmittedAt !== null}
                askedForHelpDone={profile.askedForHelpAt !== null}
                profileConfirmDone={profile.profileConfirmedAt !== null}
                industryConfirmDone={profile.industryConfirmedAt !== null}
                functionConfirmDone={profile.functionConfirmedAt !== null}
                salaryAndWorkAuthDone={
                  profile.salaryConfirmedAt !== null && profile.workAuthConfirmedAt !== null
                }
                linkedInConfirmDone={profile.linkedInConfirmedAt !== null}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Your report is generating — check back in a moment.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Check in above to see today&apos;s action plan.
        </p>
      )}

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

      <CoachChatCard initialMessages={conversation.messages} />
    </div>
  )
}
