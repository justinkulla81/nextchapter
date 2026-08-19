import type { MarketRealityReport } from '@prisma/client'
import { Suspense } from 'react'
import { after } from 'next/server'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Grade } from '@/lib/scoring/grade'
import { generateMarketRealityReport } from '@/lib/reports/market-reality-report'
import { claimReportGeneration } from '@/lib/reports/report-generation-lock'
import { sendMarketRealityReportEmail } from '@/lib/email/send-market-reality-report'
import { computeWeeklyProgress } from '@/lib/weekly/weekly-engines'
import { computeMarketRealityCompositeGrade } from '@/lib/scoring/market-reality/composite'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { getTodaysMood, getCheckInSummary, startOfUTCDay, getSentimentAlert } from '@/lib/daily/mood'
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
import { DashboardTopStrip, DashboardTopStripSkeleton } from '@/components/dashboard/DashboardTopStrip'
import { MoodCheckInCard } from '@/components/dashboard/MoodCheckInCard'
import { SuccessSprintCard } from '@/components/dashboard/SuccessSprintCard'
import { WeeklyFocusCard, WeeklyFocusSkeleton } from '@/components/dashboard/WeeklyFocusCard'
import { getProfileChecklistItems } from '@/lib/weekly/profile-checklist'
import { computeSearchStrategyChecklist } from '@/lib/weekly/search-strategy-checklist'
import { inferIndustriesFromWorkHistory } from '@/lib/onboarding/infer-industries'
import { ReconnectBanner } from '@/components/dashboard/ReconnectBanner'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { GotHiredCTACard } from '@/components/dashboard/GotHiredCTACard'
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
import { PreConnectDailyMessage } from '@/components/dashboard/PreConnectDailyMessage'
import { getHardGateStatus } from '@/lib/dashboard/access-gate'
import { isLinkedInConnected } from '@/lib/dashboard/linkedin-connection'
import { computeDossierCompleteness, isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { getResumeFixes } from '@/lib/reports/market-reality-sections'

// One step up the A>B>C>D>F ladder — A has no "better" so it maps to
// itself, but that case is never actually rendered (the Improve Your
// Market Reality card is gated on grade !== 'A').
const NEXT_BETTER_GRADE: Record<Grade, Grade> = { F: 'D', D: 'C', C: 'B', B: 'A', A: 'A' }

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
    dossierCompleteness,
    dossierStatus,
    resumeFixes,
  ] = await Promise.all([
    supabase.auth.getUser(),
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
    // Build Your Dossier summary (condensed here, full checklist + "what
    // moves the needle" lives on /dashboard/portfolio — this card links
    // through rather than duplicating it) and the Executive Dossier
    // lock/unlock status shown alongside it.
    computeDossierCompleteness(profile.id),
    isDossierUnlocked(profile.id),
    // Improve Your Market Reality — reuses the same real, point-ranked
    // resume-fix items the Market Reality Report itself shows (see
    // getResumeFixes), not a separate invented list.
    getResumeFixes(profile.id, profile.marketRealityReports[0]?.resumeRewrites ?? null),
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

  const daysSinceRegistration = profile.registrationCompletedAt
    ? (new Date().getTime() - profile.registrationCompletedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 0
  const dayNumber = Math.floor(daysSinceRegistration) + 1

  const showGotHiredCTA = weekNumber >= 2 && existingBountyClaimCount === 0

  const moodCardDismissedToday =
    profile.moodCardDismissedAt !== null && profile.moodCardDismissedAt >= startOfUTCDay()

  // The Get Started gate — same signal SuccessSprintCard's own Get Started
  // group unlocks on. Victoria's weekly focus is grounded in real Gmail/
  // Calendar/LinkedIn-derived activity, so there's nothing honest for her to
  // say before both are connected.
  const linkedInConnected = isLinkedInConnected(profile)
  const bothConnectedUnlocked = !!emailConnection && !!calendarConnection && linkedInConnected

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

      <PageHeaderBoxes
        pageKey="dashboard"
        candidateId={profile.id}
        dailyMessageOverride={
          !bothConnectedUnlocked ? (
            <PreConnectDailyMessage
              firstName={profile.firstName ?? 'there'}
              hasEmailConnection={!!emailConnection}
              hasCalendarConnection={!!calendarConnection}
            />
          ) : undefined
        }
      />

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

      <EmployerInterestSection candidateId={profile.id} />
      <PortfolioAccessRequestSection candidateId={profile.id} />

      <div className="space-y-3">
        <MoodCheckInCard
          todaysMood={todaysMood}
          checkInsLast7Days={checkInSummary.checkInsLast7Days}
          firstName={profile.firstName}
          dismissedToday={moodCardDismissedToday}
          lowSentiment={sentimentAlert.lowSentiment}
          hasCoach={!!profile.coachId}
        />

        {/* Below Check In, per user request — Victoria's advice is real
            output grounded in Gmail/Calendar/LinkedIn-derived activity, so
            it stays locked (orange lock, non-expandable) until the Get
            Started gate clears. */}
        <Suspense fallback={<WeeklyFocusSkeleton />}>
          <WeeklyFocusCard candidateId={profile.id} isMonday={isMonday} locked={!bothConnectedUnlocked} />
        </Suspense>

        <ReconnectBanner candidateId={profile.id} variant="link" />

        <DashboardNetworkCard
          followUps={needsFollowUp}
          priorityContact={priorityContacts[0] ?? null}
        />

        <SuccessSprintCard
          actions={currentSprint ? (currentSprint.committedActions as unknown as CommittedAction[]) : null}
          suggestedActions={suggestedActions}
          weeklyPoints={weeklyProgress.weeklyPoints}
          weeklyPointsTarget={weeklyProgress.weeklyPointsTarget}
          onTrack={onTrack}
          hasEmailConnection={!!emailConnection}
          hasCalendarConnection={!!calendarConnection}
          linkedInConnected={linkedInConnected}
          profileChecklistItems={profileChecklistItems}
          searchStrategyChecklist={searchStrategyChecklist}
          completedReferencesCount={completedReferencesCount}
          weekStartDate={weekStartDate}
        />

        {/* Build Your Dossier — the real §7.2 dossier-completeness checklist
            (computeDossierCompleteness), not the old Search Plan's six
            weekly-effort areas, which never actually matched what unlocks
            the Dossier. Condensed here on purpose: the full checklist +
            "what moves the needle" lives on /dashboard/portfolio; this is a
            progress summary that links through, not a duplicate. Shown to
            everyone who's cleared the hard gate (or is exempt from it),
            same audience the old Search Plan card used. */}
        {(hardGateStatus === 'unlocked' || hardGateStatus === 'exempt') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Build Your Dossier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">
                  {dossierCompleteness.metCount} of {dossierCompleteness.totalCount}
                </span>{' '}
                steps complete — real work done over time, separate from your Market Reality Grade.
                {dossierStatus.unlocked
                  ? ' Your Executive Dossier is unlocked.'
                  : ` Executive Dossier: ${dossierStatus.reason}`}
              </p>
              <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {dossierCompleteness.requirements.map((r) => (
                  <li key={r.key} className="flex items-center gap-2">
                    <span className={r.met ? 'text-success' : 'text-muted-foreground'} aria-hidden>
                      {r.met ? '✓' : '○'}
                    </span>
                    <span className={r.met ? 'text-foreground' : 'text-muted-foreground'}>{r.label}</span>
                  </li>
                ))}
              </ul>
              <Link href="/dashboard/portfolio" className="text-sm font-medium text-primary underline underline-offset-4">
                See your full Dossier progress →
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Improve Your Market Reality — real, point-ranked resume fixes
            (same list the Market Reality Report itself shows), not a
            separate invented list. Only shown when there's real room to
            improve (not already an A) and real fixes to show. */}
        {marketRealityGrade?.grade &&
          marketRealityGrade.grade !== 'A' &&
          resumeFixes &&
          resumeFixes.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Improve Your Market Reality ({marketRealityGrade.grade} → {NEXT_BETTER_GRADE[marketRealityGrade.grade]})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  The fastest lever on your grade is your resume — here&apos;s what&apos;s actually costing you
                  points.
                </p>
                <div className="space-y-2">
                  {resumeFixes.items.slice(0, 4).map((item, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium text-foreground">{item.whatsWrong}</p>
                      <p className="mt-1 text-muted-foreground">{item.fix}</p>
                      <span className="mt-1 inline-block text-xs font-semibold text-brand tabular-nums">
                        +{item.pointValue} pts
                      </span>
                    </div>
                  ))}
                </div>
                <Link href="/dashboard/market-reality" className="text-sm font-medium text-primary underline underline-offset-4">
                  See your full report →
                </Link>
              </CardContent>
            </Card>
          )}
      </div>

      {passiveToActivePrompt && <PassiveToActivePromptCard trigger={passiveToActivePrompt.trigger} />}

      {(showGotHiredCTA || needsCoachingForm) && (
        <div className="space-y-4">
          {showGotHiredCTA && <GotHiredCTACard />}
          {needsCoachingForm && <CoachingFormReminderCard />}
        </div>
      )}

      <Suspense fallback={null}>
        <SessionImpactSection candidateId={profile.id} />
      </Suspense>

      <GuideCallout pageSlot="dashboard" currentJobStatus={profile.currentJobStatus} />
    </div>
  )
}
