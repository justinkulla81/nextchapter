import type { Metadata } from 'next'
import { after } from 'next/server'
import { getDashboardData, getVerifiedSessionUser } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { regenerateMarketRealityReport, resendMyMarketRealityReportEmail } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { InlineLoadingState } from '@/components/ui/spinner'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { EmailConfirmationBanner } from '@/components/dashboard/EmailConfirmationBanner'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { countCompletedTasks, TASKS_REQUIRED_TO_REGENERATE_REPORT } from '@/lib/dashboard/completed-tasks'
import { generateMarketRealityReport } from '@/lib/reports/market-reality-report'
import { claimReportGeneration } from '@/lib/reports/report-generation-lock'
import { sendMarketRealityReportEmail } from '@/lib/email/send-market-reality-report'
import { getSuggestedActions, getMondayOfWeek, getCandidateWeekNumber } from '@/lib/weekly/sprint'
import { loadMarketRealityBrief } from '@/lib/reports/market-reality-brief/load'
import { captureServerEvent } from '@/lib/posthog/server'
import { Cover, ExecutiveSummary, BasisSection } from '@/components/market-reality/summary-sections'
import {
  ActivitySection,
  DirectionSection,
  CaseSection,
  EvaluatorSection,
  ObjectionsSection,
  ProfileSection,
  ExperienceSection,
  MarketSection,
  MethodNotes,
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

  const completedTasks = countCompletedTasks(profile)
  const canRegenerate = completedTasks >= TASKS_REQUIRED_TO_REGENERATE_REPORT

  const suggestedActions = await getCandidateWeekNumber(profile.id, getMondayOfWeek(new Date())).then((weekNumber) =>
    getSuggestedActions(profile.id, weekNumber)
  )
  const brief = await loadMarketRealityBrief(profile, {
    resumeRewrites: report?.resumeRewrites ?? null,
    documentStrengths: report?.strengths ?? null,
    jobSearchPattern: report?.jobSearchPattern ?? null,
    suggestedActions,
  })

  after(() =>
    captureServerEvent(profile.id, 'market_reality_report_viewed', {
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
          Every section updates as your profile and activity change.
          {canRegenerate
            ? ' Regenerate to refresh the resume rewrites and the weekly action plan.'
            : ` Resume rewrites and the weekly action plan refresh when you regenerate, after ${TASKS_REQUIRED_TO_REGENERATE_REPORT} completed tasks (${completedTasks} so far).`}
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
          {canRegenerate && (
            <form action={regenerateMarketRealityReport}>
              <SubmitButton variant="outline" pendingLabel="Regenerating…">
                Regenerate my report
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl print:hidden">
        <PageHeaderBoxes pageKey="market-reality" candidateId={profile.id} />
      </div>

      {!report && (
        <div className="mx-auto max-w-4xl print:hidden">
          <InlineLoadingState label="Resume rewrites and your weekly action plan are still generating. The rest of the report is ready." />
        </div>
      )}

      <article className="mx-auto max-w-4xl space-y-10 border border-border bg-white px-6 py-8 sm:px-12 sm:py-12 print:max-w-none print:space-y-8 print:border-0 print:p-0">
        <Cover brief={brief} />
        <ExecutiveSummary brief={brief} />
        <EvaluatorSection brief={brief} />
        <CaseSection brief={brief} />
        <ObjectionsSection brief={brief} />
        <ProfileSection brief={brief} />
        <BasisSection brief={brief} />
        <MarketSection brief={brief} marketScope={marketScope} candidateId={profile.id} />
        <RequirementsSection brief={brief} />
        <ExperienceSection brief={brief} />
        <SkillsSection brief={brief} />
        <ResumeSection brief={brief} />
        <DirectionSection brief={brief} />
        <ActivitySection brief={brief} />
        <LaunchpadSection brief={brief} />
        <MethodNotes />
      </article>
    </div>
  )
}
