import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { generateHireabilityReport } from '@/lib/reports/hireability-report'
import { calculateEmployabilityScore, scoreToNextSteps } from '@/lib/scoring/employability-score'
import { getScoreFramingCopy } from '@/lib/scoring/score-framing'
import { getSetupChecklistItems } from '@/lib/onboarding/setup-checklist'
import { getQuoteOfTheDay } from '@/lib/constants/quotes'
import { getOrCreateCoachConversation } from '@/lib/coach/get-conversation'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
import { DualGradeCard } from '@/components/dashboard/DualGradeCard'
import { ActionPlanCard, type ActionDay } from '@/components/dashboard/ActionPlanCard'
import { CoachChatCard } from '@/components/dashboard/CoachChatCard'
import { LinkedInActivityCard } from '@/components/dashboard/LinkedInActivityCard'
import { SetupChecklist } from '@/components/dashboard/SetupChecklist'
import { EmailConfirmationBanner } from '@/components/dashboard/EmailConfirmationBanner'
import { WorkStyleProfileCard } from '@/components/dashboard/WorkStyleProfileCard'
import { fillHelpScriptTemplate } from '@/lib/constants/help-script-template'
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
  const framingCopy = await getScoreFramingCopy(profile.employabilityScore)
  const checklistItems = getSetupChecklistItems(profile)
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

  const linkedInWindowStart = new Date()
  linkedInWindowStart.setDate(linkedInWindowStart.getDate() - 30)
  const recentLinkedInLogCount = profile.linkedInActivityLogs.filter(
    (l) => l.loggedAt > linkedInWindowStart
  ).length
  const startOfTodayUTC = new Date()
  startOfTodayUTC.setUTCHours(0, 0, 0, 0)
  const loggedLinkedInToday = profile.linkedInActivityLogs.some((l) => l.loggedAt >= startOfTodayUTC)

  return (
    <div className="space-y-8">
      {user && !user.email_confirmed_at && user.email && (
        <EmailConfirmationBanner email={user.email} />
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Success Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          {profile.displayName ? `Welcome back, ${profile.displayName}` : 'Welcome back'}
        </p>
        <blockquote className="mt-2 text-muted-foreground italic">
          &ldquo;{quote.text}&rdquo;
          <footer className="mt-1 text-sm not-italic text-muted-foreground/80">— {quote.author}</footer>
        </blockquote>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <DualGradeCard
              grade={grade}
              tier={profile.visibilityTier}
              nextSteps={nextSteps}
              framingCopy={framingCopy}
              scoreLastCalculated={profile.scoreLastCalculated}
            />
          </CardContent>
        </Card>

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
                helpScript={fillHelpScriptTemplate(profile)}
                networkingListDone={profile.networkingListSubmittedAt !== null}
                askedForHelpDone={profile.askedForHelpAt !== null}
                profileConfirmDone={profile.profileConfirmedAt !== null}
                industryConfirmDone={profile.industryConfirmedAt !== null}
                functionConfirmDone={profile.functionConfirmedAt !== null}
                salaryAndWorkAuthDone={
                  profile.salaryConfirmedAt !== null && profile.workAuthConfirmedAt !== null
                }
                linkedInConfirmDone={profile.linkedInConfirmedAt !== null}
                candidateDraft={{
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  phone: profile.phone,
                  streetAddress: profile.streetAddress,
                  currentCity: profile.currentCity,
                  currentState: profile.currentState,
                  industryContext: profile.industryContext,
                  primaryFunction: profile.primaryFunction,
                  resumeLatestJobTitle: profile.resumeLatestJobTitle,
                  yearsExperience: profile.yearsExperience,
                  highestLevelReached: profile.highestLevelReached,
                  lastSalary: profile.lastSalary,
                  workAuthorization: profile.workAuthorization,
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Your report is generating — check back in a moment.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

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
              <Link
                href="/onboarding/working-style"
                className="inline-block text-sm font-medium text-primary underline underline-offset-4"
              >
                Take the Work Style Assessment
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">References</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold tabular-nums">
              {profile.references.filter((r) => r.status === 'COMPLETED').length}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Job Fit</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold tabular-nums">{profile.jobPostings.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Work Samples</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold tabular-nums">{profile.workSamples.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Community Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold tabular-nums">{profile.communityPosts.length}</span>
          </CardContent>
        </Card>
      </div>

      <LinkedInActivityCard recentLogCount={recentLinkedInLogCount} loggedToday={loggedLinkedInToday} />

      <CoachChatCard initialMessages={conversation.messages} />

      <SetupChecklist items={checklistItems} />
    </div>
  )
}
