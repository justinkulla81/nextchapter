import type { Metadata } from 'next'
import { after } from 'next/server'
import { getDashboardData, getVerifiedSessionUser } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { resendMyMarketRealityReportEmail } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { InlineLoadingState } from '@/components/ui/spinner'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { EmailConfirmationBanner } from '@/components/dashboard/EmailConfirmationBanner'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { getUnlockStatus } from '@/lib/effort/load'
import Link from 'next/link'
import { generateMarketRealityReport } from '@/lib/reports/market-reality-report'
import { claimReportGeneration } from '@/lib/reports/report-generation-lock'
import { sendMarketRealityReportEmail } from '@/lib/email/send-market-reality-report'
import { getSuggestedActions, getMondayOfWeek, getCandidateWeekNumber } from '@/lib/weekly/sprint'
import { loadMarketRealityBrief } from '@/lib/reports/market-reality-brief/load'
import { buildWeeklyChange, readStateOf } from '@/lib/reports/market-reality-brief/weekly-change'
import { previousReadState, saveReadState } from '@/lib/reports/market-reality-brief/read-state-store'
import { captureServerEvent } from '@/lib/posthog/server'
import { PrintFrame } from '@/components/market-reality/report-ui'
import { Cover, ExecutiveSummary, BasisSection } from '@/components/market-reality/summary-sections'
import {
  ActivitySection,
  DirectionSection,
  AppendixDivider,
  HiringCaseSection,
  EvaluatorSection,
  ObjectionsSection,
  ProfileSection,
  ExperienceSection,
  MarketSection,
  MethodNotes,
  RubricSection,
  SharpenPanel,
  WhatChangedCard,
  RequirementsSection,
  ResumeSection,
  SkillsSection,
  LaunchpadSection,
} from '@/components/market-reality/analysis-sections'

export const metadata: Metadata = { title: 'Market Reality Report' }

export default async function MarketRealityReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const marketScope = (await searchParams).market === 'us' ? 'us' : 'state'
  const profile = await getDashboardData()
  const [user, report] = await Promise.all([
    getVerifiedSessionUser(),
    prisma.marketRealityReport.findFirst({
      where: { candidateId: profile.id },
      orderBy: { generatedAt: 'desc' },
    }),
  ])

  // Normally generated as a fire-and-forget side effect of the first
  // dashboard load after registration (see getDashboardData's justRegistered
  // branch). If this page is reached before that finished — or it failed
  // silently — kick off generation now, without blocking this request on an
  // LLM call. The report itself reads live data and renders without it; the
  // stored row only supplies the resume rewrites, the weekly action plan and
  // the application/rejection patterns. claimReportGeneration guards against
  // racing the registration-time after() callback.
  if (!report) {
    after(async () => {
      if (await claimReportGeneration(profile.id)) {
        try {
          await generateMarketRealityReport(profile.id)
          await sendMarketRealityReportEmail(profile.id)
        } catch (error) {
          console.error('Failed to generate market reality report on demand:', error)
        }
      }
    })
  }
  // The registration-time after() callback can be cut off before the email
  // step runs, leaving a generated report permanently unsent — close that gap
  // on every load. Backgrounded: it makes two external network calls.
  if (report && !report.emailSentAt) {
    after(() =>
      sendMarketRealityReportEmail(profile.id).catch((error) =>
        console.error('Failed to send market reality report email:', error)
      )
    )
  }

  const unlock = await getUnlockStatus(profile.id)

  const suggestedActions = await getCandidateWeekNumber(profile.id, getMondayOfWeek(new Date())).then((weekNumber) =>
    getSuggestedActions(profile.id, weekNumber)
  )
  const brief = await loadMarketRealityBrief(profile, {
    resumeRewrites: report?.resumeRewrites ?? null,
    documentStrengths: report?.strengths ?? null,
    jobSearchPattern: report?.jobSearchPattern ?? null,
    suggestedActions,
  })

  // What moved since the last saved read. Saved after the response, so a slow or missing table never
  // holds the page up; the latest view in a week is the read that week keeps.
  const weekStart = getMondayOfWeek(new Date())
  const prevRead = await previousReadState(profile.id, weekStart)
  const currentRead = readStateOf(brief)
  const change = prevRead ? buildWeeklyChange(prevRead.state, currentRead, brief.hiringCase, prevRead.weekStartDate.toISOString()) : null
  after(() => saveReadState(profile.id, weekStart, currentRead))

  after(() =>
    captureServerEvent(profile.id, 'market_reality_report_viewed', {
      changedSinceLastWeek: change ? change.hasChange : null,
      grade: brief.summary.grade,
      assessments: Object.fromEntries(brief.summary.scorecard.map((r) => [r.dimension, r.assessment])),
      priorities: brief.summary.priorities.map((p) => p.key),
      marketPrompt: brief.market?.prompt ?? null,
      openRoles: brief.market?.openRoles ?? null,
      pivotsShown: brief.pivots !== null,
      experienceDevelopmentAreas: brief.experience.developmentCount,
      hasResume: brief.resume !== null,
      unconfirmedProfileItems: brief.basis.unconfirmed.length,
    })
  )

  return (
    <div className="space-y-6">
      {user && !user.email_confirmed_at && user.email && (
        <div className="print:hidden">
          <EmailConfirmationBanner email={user.email} />
        </div>
      )}

      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="max-w-xl text-sm text-muted-foreground">
          Every section updates as your profile and activity change. A full refresh of the resume rewrites and the weekly action plan comes with your next strategy.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <PrintReportButton event="market_reality_report_printed" properties={{ grade: brief.summary.grade }} />
          {report && !report.emailSentAt && (
            <form action={resendMyMarketRealityReportEmail}>
              <SubmitButton variant="outline" pendingLabel="Sending…">
                Email me this report
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl print:hidden">
        <PageHeaderBoxes pageKey="market-reality" candidateId={profile.id} />
      </div>

      <p className="mx-auto max-w-4xl text-sm text-muted-foreground print:hidden">
        {unlock.unlocked ? 'Your next strategy is earned, and it refreshes this report with it. ' : `${unlock.score.total} of ${unlock.bar.points} strategy credits toward your next strategy and a full refresh of this report. `}
        <Link href="/dashboard/search-strategy#unlock" className="text-primary underline underline-offset-4">
          {unlock.unlocked ? 'Generate it' : 'See how to earn the rest'}
        </Link>
      </p>

      {!report && (
        <div className="mx-auto max-w-4xl print:hidden">
          <InlineLoadingState label="Resume rewrites and your weekly action plan are still generating. The rest of the report is ready." />
        </div>
      )}

      <PrintFrame label={`NextChapter · Confidential · Market Reality Report · ${brief.candidateName}`} />
      <article className="mx-auto max-w-4xl space-y-10 border border-border bg-white px-6 py-8 sm:px-12 sm:py-12 print:max-w-none print:space-y-4 print:border-0 print:p-0 print:[zoom:0.75]">
        <Cover brief={brief} />
        <ExecutiveSummary brief={brief} />
        <WhatChangedCard change={change} brief={brief} />
        <SharpenPanel brief={brief} />
        <HiringCaseSection brief={brief} />
        <EvaluatorSection brief={brief} />
        <ObjectionsSection brief={brief} />
        <MarketSection brief={brief} marketScope={marketScope} candidateId={profile.id} />
        <RequirementsSection brief={brief} />
        <DirectionSection brief={brief} />
        <LaunchpadSection brief={brief} />
        <AppendixDivider />
        <BasisSection brief={brief} />
        <ProfileSection brief={brief} />
        <ExperienceSection brief={brief} />
        <SkillsSection brief={brief} />
        <ResumeSection brief={brief} />
        <ActivitySection brief={brief} />
        <RubricSection />
        <MethodNotes />
      </article>
    </div>
  )
}
