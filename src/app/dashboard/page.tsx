import type { MarketRealityReport } from '@prisma/client'
import { OutplacementProgramCard } from '@/components/dashboard/OutplacementProgramCard'
import { effectiveJourney, effectiveStage, getJourney, getStage } from '@/lib/journey/journey'
import { Suspense } from 'react'
import { FreshJobsPrompt } from '@/components/dashboard/FreshJobsPrompt'
import { CultureSurveyPrompt } from '@/components/dashboard/CultureSurveyPrompt'
import { after } from 'next/server'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getDashboardData, getVerifiedSessionUser } from '@/lib/dashboard/get-dashboard-data'
import { generateMarketRealityReport } from '@/lib/reports/market-reality-report'
import { claimReportGeneration } from '@/lib/reports/report-generation-lock'
import { sendMarketRealityReportEmail } from '@/lib/email/send-market-reality-report'
import { computeWeeklyProgress } from '@/lib/weekly/weekly-engines'
import { computeProbabilityGrade } from '@/lib/scoring/market-reality/probability'
import { evaluatePassiveToActivePrompt } from '@/lib/dashboard/passive-to-active-prompt'
import { PassiveToActivePromptCard } from '@/components/dashboard/PassiveToActivePromptCard'
import { evaluateStalledSearchPrompt } from '@/lib/dashboard/stalled-search-prompt'
import { StalledSearchPromptCard } from '@/components/dashboard/StalledSearchPromptCard'
import { loadSearchPlaybook } from '@/lib/dashboard/search-playbook-data'
import { SearchPlaybookCard } from '@/components/dashboard/search-playbook/SearchPlaybookCard'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  getCurrentWeekSprintForRender,
  getSuggestedActions,
  getMondayOfWeek,
  getCandidateWeekNumber,
  type CommittedAction,
} from '@/lib/weekly/sprint'
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
import { getNeedsFollowUpList } from '@/lib/network/needs-follow-up'
import { getEmailReminders } from '@/lib/network/reminders'
import { DashboardNetworkCard } from '@/components/dashboard/DashboardNetworkCard'
import { PreConnectDailyMessage } from '@/components/dashboard/PreConnectDailyMessage'
import { ReportReadyDailyMessage } from '@/components/dashboard/ReportReadyDailyMessage'
import { getHardGateStatus, isSearchStrategyGateComplete } from '@/lib/dashboard/access-gate'
import { SearchStrategyDailyMessage } from '@/components/dashboard/SearchStrategyDailyMessage'
import { isLinkedInConnected } from '@/lib/dashboard/linkedin-connection'
import { computeDossierCompleteness, getDossierLadderTier, getModuleGateStatus, isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { buildUnlockLadder } from '@/lib/unlocks/ladder'
import { HomeModule } from '@/components/dashboard/home/HomeModule'
import { JobsModule } from '@/components/dashboard/home/JobsModule'
import { UnlocksModule } from '@/components/dashboard/home/UnlocksModule'
import { getResumeFixes } from '@/lib/reports/market-reality-sections'

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
// computeProbabilityGrade's market/company-size lookups, this one has no
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

// Three plain counts for the Jobs module. Saved = on the list and not yet
// applied to; Interviews = the member said they landed one.
async function getHomeJobCounts(candidateId: string) {
  const [saved, applied, interviews] = await Promise.all([
    prisma.jobPosting.count({ where: { candidateId, appliedAt: null } }),
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { not: null } } }),
    prisma.jobPosting.count({ where: { candidateId, interviewLandedAt: { not: null } } }),
  ])
  return { saved, applied, interviews }
}

export default async function DashboardPage() {
  const profile = await getDashboardData()
  // Journey and stage (src/lib/journey): the header's goal, the plan line, and
  // whether "Has anything changed?" is due at this stage's pace.
  const journeyNow = effectiveJourney(profile)
  const stageNow = effectiveStage(profile)
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

  // All of these are independent of one another — issuing them together
  // instead of one-by-one turns ~9 sequential round trips into one parallel
  // batch, which is where most of this page's load time was going.
  const [
    user,
    weeklyProgress,
    marketRealityGrade,
    currentSprint,
    suggestedActions,
    existingBountyClaimCount,
    hasCoachingFormResponse,
    profileChecklistItems,
    emailConnection,
    calendarConnection,
    needsFollowUp,
    priorityContacts,
    passiveToActivePrompt,
    stalledSearchPrompt,
    dossierCompleteness,
    dossierStatus,
    resumeFixes,
    searchPlaybook,
    ladderTier,
    moduleGates,
    jobCounts,
  ] = await Promise.all([
    getVerifiedSessionUser(),
    computeWeeklyProgress(profile.id, weekNumber, profile.privacyTier, profile.confidentialSearchMode),
    // The one candidate-facing Market Reality Assessment — computeProbabilityGrade
    // is the single orchestrator (scoring/market-reality/probability.ts);
    // never call computeMarketRealityCompositeGrade directly here, that
    // would be a second, parallel computation of the starting-band input.
    computeProbabilityGrade(profile.id),
    getCurrentWeekSprintForRender(profile.id),
    getSuggestedActions(profile.id, weekNumber),
    prisma.bountyClaim.count({ where: { candidateId: profile.id } }),
    // Prompt 60 — passive fallback for candidates whose consent was granted
    // before this feature existed (or who navigated away before completing
    // the form); the explicit redirects at consent-grant time are the
    // primary path, this just catches anyone who slips past them.
    profile.coachId && profile.coachDossierConsentedAt
      ? hasSubmittedCoachingOnboardingForm(profile.id)
      : Promise.resolve(true),
    getProfileChecklistItems(profile.id),
    prisma.emailConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null } }),
    prisma.calendarConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null } }),
    getNeedsFollowUpList(profile.id),
    getEmailReminders(profile.id),
    // §10-12 — read-only trigger check; PassiveToActivePromptCard records
    // "shown" itself once it actually renders (see that component).
    evaluatePassiveToActivePrompt(profile.id),
    // Same read-only, records-on-render contract, for the "hitting your
    // goals but no interviews" nudge — see stalled-search-prompt.ts.
    evaluateStalledSearchPrompt(profile.id),
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
    // Journey-aware search plan: what to change at this point in the search.
    // Read-only, no metered calls. See src/lib/journey/search-playbook.ts.
    loadSearchPlaybook(profile),
    getDossierLadderTier(profile.id),
    getModuleGateStatus(profile.id),
    getHomeJobCounts(profile.id),
  ])
  const needsCoachingForm = !!profile.coachId && !!profile.coachDossierConsentedAt && !hasCoachingFormResponse

  if (searchPlaybook) {
    const position = searchPlaybook
    after(() =>
      captureServerEvent(profile.id, 'search_playbook_viewed', {
        journey: position.journey,
        weeks: position.clock.weeks,
        basis: position.clock.basis,
        milestoneWeek: position.current?.atWeek ?? null,
        longTermUnemployed: position.isLongTermUnemployed,
      })
    )
  }

  // getResumeFixes (Market Reality Report's resumeRewrites) is null for any
  // candidate whose latest report predates that field or hasn't regenerated
  // since — a real production case where the actual latest resume still has
  // plenty of open findings (Resume.atsFeedback/resultsFeedback/
  // experienceFeedback, the same data /dashboard/resume's own version list
  // reads) that getResumeFixes alone would miss entirely.
  const latestResume = profile.resumes[0]
  const latestResumeIssueCount = latestResume
    ? ([latestResume.atsFeedback, latestResume.resultsFeedback, latestResume.experienceFeedback] as unknown[][])
        .reduce((n, feedback) => n + (Array.isArray(feedback) ? feedback.length : 0), 0)
    : 0
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
  // dashboard-wide hard gate (see access-gate.ts), which now checks only
  // Search Strategy completion.
  const hardGateStatus = getHardGateStatus(profile)


  const showGotHiredCTA = weekNumber >= 2 && existingBountyClaimCount === 0

  // The Get Started gate — same signal SuccessSprintCard's own Get Started
  // group unlocks on. Victoria's weekly focus is grounded in real Gmail/
  // Calendar/LinkedIn-derived activity, so there's nothing honest for her to
  // say before both are connected.
  const linkedInConnected = isLinkedInConnected(profile)
  const bothConnectedUnlocked = !!emailConnection && !!calendarConnection && linkedInConnected

  // Takes priority over PreConnectDailyMessage below — a candidate who just
  // earned the Market Reality Assessment badge (their first-ever badge, in
  // practice) hasn't seen the Badges shelf yet, so badgesLastSeenCount is
  // still null. That self-clears the moment they view it (see
  // MarkBadgesViewedOnMount), so this only ever shows once.
  const showReportReadyMessage = profile.marketRealityReports.length > 0 && profile.badgesLastSeenCount === null

  // One note at a time. The first of these that applies is the note; the rest
  // wait. Order: something time-sensitive first, then a nudge, then a prompt.
  const noteKind: string | null = needsCoachingForm
    ? 'coaching_form'
    : stalledSearchPrompt
      ? 'stalled_search'
      : passiveToActivePrompt
        ? 'passive_to_active'
        : showGotHiredCTA
          ? 'got_hired'
          : searchPlaybook
            ? 'search_playbook'
            : 'culture_survey'
  after(() => captureServerEvent(profile.id, 'home_note_shown', { kind: noteKind, journey: journeyNow, stage: stageNow, weekNumber }))

  const ladder = buildUnlockLadder({ gates: moduleGates, tier: ladderTier.tier, completeness: dossierCompleteness, status: dossierStatus })
  const evidenceAreas = dossierCompleteness.requirements.filter((r) => r.met).length

  return (
    <div className="space-y-8">
      {user && !user.email_confirmed_at && user.email && (
        <EmailConfirmationBanner email={user.email} />
      )}
      <PendingEmployerReferenceBanner candidateEmail={user?.email ?? null} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {journeyNow ? getJourney(journeyNow).goal : <>NextChapter&apos;s goal is to get you a job. Let&apos;s go!</>}
        </h1>
        {journeyNow && stageNow && (
          <p className="mt-2 text-sm text-muted-foreground">
            Your plan is set up for{' '}
            <span className="rounded-full bg-navy px-2 py-0.5 text-xs font-semibold text-white">{getStage(stageNow).label}</span>{' '}
            <Link href="/dashboard/privacy" className="font-medium text-brand underline underline-offset-4">
              Not quite right? Change
            </Link>
          </p>
        )}
      </div>

      <OutplacementProgramCard candidateId={profile.id} />

      {/* Today's note: the daily message, always in the same place. */}
      <PageHeaderBoxes
        pageKey="dashboard"
        candidateId={profile.id}
        dailyMessageOverride={
          showReportReadyMessage ? (
            <ReportReadyDailyMessage firstName={profile.firstName ?? 'there'} />
          ) : !isSearchStrategyGateComplete(profile) ? (
            <SearchStrategyDailyMessage firstName={profile.firstName ?? 'there'} />
          ) : !bothConnectedUnlocked ? (
            <PreConnectDailyMessage
              firstName={profile.firstName ?? 'there'}
              hasEmailConnection={!!emailConnection}
              hasCalendarConnection={!!calendarConnection}
              linkedInConnected={linkedInConnected}
            />
          ) : undefined
        }
      />

      {noteKind === 'coaching_form' && <CoachingFormReminderCard />}
      {noteKind === 'stalled_search' && stalledSearchPrompt && <StalledSearchPromptCard {...stalledSearchPrompt} />}
      {noteKind === 'passive_to_active' && passiveToActivePrompt && <PassiveToActivePromptCard trigger={passiveToActivePrompt.trigger} />}
      {noteKind === 'got_hired' && <GotHiredCTACard />}
      {noteKind === 'search_playbook' && searchPlaybook && <SearchPlaybookCard position={searchPlaybook} />}
      {noteKind === 'culture_survey' && (
        <Suspense fallback={null}>
          <CultureSurveyPrompt candidateId={profile.id} />
        </Suspense>
      )}

      {/* People waiting on you: always worth seeing, so they sit outside the note. */}
      <EmployerInterestSection candidateId={profile.id} />
      <PortfolioAccessRequestSection candidateId={profile.id} />
      <ReconnectBanner candidateId={profile.id} returnTo="/dashboard" variant="link" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6 lg:col-span-2">
          <Suspense fallback={<WeeklyFocusSkeleton />}>
            <WeeklyFocusCard
              candidateId={profile.id}
              locked={!bothConnectedUnlocked}
              weeklyPoints={weeklyProgress.weeklyPoints}
              weeklyPointsTarget={weeklyProgress.weeklyPointsTarget}
            />
          </Suspense>
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
            marketRealityGrade={marketRealityGrade?.probabilityGrade ?? null}
            hasUnresolvedResumeIssues={latestResumeIssueCount > 0 || (resumeFixes !== null && resumeFixes.items.length > 0)}
          />
        </div>
        <JobsModule saved={jobCounts.saved} applied={jobCounts.applied} interviews={jobCounts.interviews}>
          <Suspense fallback={null}>
            <FreshJobsPrompt profile={profile} />
          </Suspense>
        </JobsModule>
        <HomeModule
          title="Network"
          action={
            <Link href="/dashboard/network" className="text-sm font-medium text-brand underline underline-offset-4">
              Open Network
            </Link>
          }
        >
          <DashboardNetworkCard followUps={needsFollowUp} priorityContact={priorityContacts[0] ?? null} />
        </HomeModule>
        {(hardGateStatus === 'unlocked' || hardGateStatus === 'exempt') && (
          <div className="lg:col-span-2">
            <UnlocksModule ladder={ladder} evidenceAreas={evidenceAreas} evidenceTotal={dossierCompleteness.totalCount} confidential={profile.confidentialSearchMode} />
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <SessionImpactSection candidateId={profile.id} />
      </Suspense>
    </div>
  )
}
