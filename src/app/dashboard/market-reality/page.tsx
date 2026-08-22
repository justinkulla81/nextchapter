import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { after } from 'next/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { isSearchGoalsComplete } from '@/lib/search-strategy'
import { getOrDraftSearchStrategyGuidance } from '@/lib/reports/search-strategy-guidance'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'
import { createClient } from '@/lib/supabase/server'
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
import { GRADE_LABEL, GRADE_TEXT_COLOR } from '@/lib/scoring/grade'
import { GradeSystemExplainer } from '@/components/dashboard/GradeSystemExplainer'
import { cn } from '@/lib/utils'
import {
  getWhereYouStand,
  getResumeFixes,
  getRecruiterReadItems,
  getAtsMatrix,
  getMarketRealityRubric,
} from '@/lib/reports/market-reality-sections'
import { computeDossierCompleteness } from '@/lib/scoring/dossier-unlock'
import { ReviewerExplanationForm } from '@/components/dashboard/ReviewerExplanationForm'
import { EstimateTag } from '@/components/ui/estimate-tag'

export const metadata: Metadata = { title: 'Market Reality Report' }

// Same self-caching guidance shown on /dashboard/search-strategy — reading
// it here is just a cache hit in the common case (see
// getOrDraftSearchStrategyGuidance's self-cache), so this rarely triggers a
// fresh LLM call, but it's isolated in its own Suspense boundary anyway in
// case it does. Only renders once the full Search Goals section is filled
// in — see isSearchGoalsComplete.
async function SearchStrategyGuidanceSection({ candidateId }: { candidateId: string }) {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: {
      targetRoleType: true,
      primaryFunction: true,
      targetIndustries: true,
      targetCompanySize: true,
      targetCompanyStage: true,
      remotePreference: true,
      highestLevelReached: true,
    },
  })
  if (!isSearchGoalsComplete(candidate)) return null

  const guidance = await getOrDraftSearchStrategyGuidance(candidateId)
  if (!guidance) return null

  return (
    <div className="mt-10 border-t border-border pt-8 print:hidden">
      <div className="flex items-center gap-3">
        <VictoriaAvatar size={36} />
        <SectionHeading>Strategy Guidance from Victoria</SectionHeading>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-semibold tracking-wide text-success uppercase">What&apos;s working</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-foreground">
            {guidance.pros.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-semibold tracking-wide text-warning uppercase">What to watch</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-foreground">
            {guidance.cons.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-semibold tracking-wide text-brand uppercase">What I&apos;d change</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-foreground">
            {guidance.suggestedChanges.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

interface Strength {
  title: string
  detail: string
}

interface TrendBreakdownEntry {
  label: string
  count: number
}

type FocusLabel = 'focused' | 'mixed' | 'scattered'
type VolumeAssessment = 'too_few' | 'on_track' | 'too_many'

interface ApplicationTrendsData {
  eligible: boolean
  minRequired: number
  totalApplications: number
  functionBreakdown: TrendBreakdownEntry[] | null
  functionFocus: FocusLabel | null
  industryBreakdown: TrendBreakdownEntry[] | null
  industryFocus: FocusLabel | null
  geographyBreakdown: TrendBreakdownEntry[] | null
  geographyFocus: FocusLabel | null
  applicationsPerWeek: number | null
  volumeGoalPerWeek: number | null
  volumeAssessment: VolumeAssessment | null
}

const FOCUS_LABEL: Record<FocusLabel, string> = {
  focused: 'Focused',
  mixed: 'A mix',
  scattered: 'Scattered',
}

const VOLUME_ASSESSMENT_LABEL: Record<VolumeAssessment, string> = {
  too_few: 'Below a healthy pace',
  on_track: 'On pace',
  too_many: 'Very high volume',
}

interface JobSearchPatternData {
  summary: string | null
  signalCount: number
  minRequired: number
  applicationTrends: ApplicationTrendsData | null
}

interface ExecutiveSummary {
  improvementNarrative: string[]
  whatToDoMore: string[]
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-widest text-brand uppercase">{children}</h2>
  )
}

export default async function MarketRealityReportPage() {
  const profile = await getDashboardData()
  const [{ data: { user } }, report] = await Promise.all([
    createClient().then((supabase) => supabase.auth.getUser()),
    prisma.marketRealityReport.findFirst({
      where: { candidateId: profile.id },
      orderBy: { generatedAt: 'desc' },
    }),
  ])

  // Normally generated as a fire-and-forget side effect of the first
  // dashboard load after registration (see getDashboardData's justRegistered
  // branch). If this page is reached before that's finished — or it failed
  // silently — kick off generation now instead of leaving the candidate
  // stuck on "check back in a moment" forever, but don't block this
  // request on an LLM call that can take many seconds — the page already
  // has a real "generating" loading state below for exactly this gap, and
  // a reload once it's done shows the finished report. claimReportGeneration
  // guards against this racing the registration-time after() callback above.
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
  // See dashboard/page.tsx's identical fallback — the registration-time
  // after() callback that normally generates AND emails this report can get
  // cut off before the email step ever runs, leaving a real, generated
  // report permanently unsent. Close that gap on every load, not just the
  // first — this is what actually fixes it for reports that already exist.
  // Backgrounded via after(): sendMarketRealityReportEmail makes two live
  // external network calls (Supabase admin getUserById, then Resend) that
  // have no business blocking this page's render.
  if (report && !report.emailSentAt) {
    after(() =>
      sendMarketRealityReportEmail(profile.id).catch((error) =>
        console.error('Failed to send market reality report email:', error)
      )
    )
  }

  const completedTasks = countCompletedTasks(profile)
  const canRegenerate = completedTasks >= TASKS_REQUIRED_TO_REGENERATE_REPORT
  const weekNumber = await getCandidateWeekNumber(profile.id, getMondayOfWeek(new Date()))
  const suggestedActions = await getSuggestedActions(profile.id, weekNumber)

  // MRG §11 — the rebuilt report's 7 mandated sections (Report Structure
  // Spec §3), read live rather than frozen into the report row so a
  // resolved reviewer question or a freshly-recomputed component score is
  // never stale (see market-reality-sections.ts's own header comment).
  const [whereYouStand, resumeFixes, recruiterReadItems, atsMatrix, dossierCompleteness, rubric] = await Promise.all([
    getWhereYouStand(profile.id),
    getResumeFixes(profile.id, report?.resumeRewrites ?? null),
    getRecruiterReadItems(profile.id),
    getAtsMatrix(profile.id),
    computeDossierCompleteness(profile.id),
    getMarketRealityRubric(profile.id),
  ])

  // Personalization checklist — the same profile-confirmation fields
  // already gathered into the report's own prompt (market-reality-report.ts)
  // and used to gate report regeneration (completed-tasks.ts), rendered
  // directly here since they're already on `profile`. This is the report's
  // "next steps": unlike the pre-dashboard onboarding wizard (which is
  // already 100% done by the time this page is reachable at all), these
  // stay genuinely incomplete for a while after registration.
  const personalizationSteps = [
    { key: 'profile', label: 'Confirm your profile details', done: profile.profileConfirmedAt !== null, href: '/dashboard/profile' },
    { key: 'industry', label: 'Confirm your industry', done: profile.industryConfirmedAt !== null, href: '/dashboard/profile' },
    { key: 'function', label: 'Confirm your function, title, and years', done: profile.functionConfirmedAt !== null, href: '/dashboard/profile' },
    { key: 'salary', label: 'Confirm salary and work authorization', done: profile.salaryConfirmedAt !== null && profile.workAuthConfirmedAt !== null, href: '/dashboard/profile' },
    { key: 'linkedin', label: 'Confirm your LinkedIn status', done: profile.linkedInConfirmedAt !== null, href: '/dashboard/profile' },
  ]

  const candidateName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Candidate'
  const preparedDate = report
    ? new Date(report.generatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <div className="space-y-6">
      {user && !user.email_confirmed_at && user.email && (
        <div className="print:hidden">
          <EmailConfirmationBanner email={user.email} />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market Reality Report</h1>
          <p className="mt-1 text-muted-foreground">
            Your strengths, gaps, and an action plan — built from everything in your profile.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {report && (
            <>
              <PrintReportButton />
              {!report.emailSentAt && (
                <form action={resendMyMarketRealityReportEmail}>
                  <SubmitButton variant="outline" pendingLabel="Sending…">
                    Email me this report
                  </SubmitButton>
                </form>
              )}
            </>
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

      <div className="print:hidden">
        <PageHeaderBoxes pageKey="market-reality" candidateId={profile.id} />
      </div>

      {!canRegenerate && (
        <p className="text-sm text-muted-foreground print:hidden">
          Your report is a snapshot — you can regenerate it once you&apos;ve completed{' '}
          {TASKS_REQUIRED_TO_REGENERATE_REPORT} tasks from your action plan (
          {completedTasks}/{TASKS_REQUIRED_TO_REGENERATE_REPORT} so far).
        </p>
      )}

      {!report ? (
        <InlineLoadingState label="Your report is generating — check back in a moment." />
      ) : (
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-white p-8 shadow-sm sm:p-12">
          {/* Letterhead */}
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-navy pb-6">
            <div>
              <p className="text-2xl font-bold tracking-tight text-navy">NextChapter</p>
              <p className="mt-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Market Reality Report
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Prepared for {candidateName}</p>
              {preparedDate && <p>{preparedDate}</p>}
            </div>
          </div>

          {/* Confidentiality notice */}
          <p className="mt-4 text-xs text-muted-foreground italic">
            Confidential — prepared solely for the use of the named candidate. This report contains
            personal career information and is not intended for distribution to third parties,
            including current or prospective employers, without the candidate&apos;s explicit
            consent.
          </p>

          {/* Glossary — moved to the front, ahead of the confidential report
              body, and no longer print:hidden: the candidate reads grades
              throughout this whole document (including in print/PDF), so
              the explainer for what they mean has to be visible wherever
              the report is. */}
          <div className="mt-8 rounded-lg border border-border bg-muted/30 p-5">
            <SectionHeading>Glossary — how to read this report</SectionHeading>
            <div className="mt-4">
              <GradeSystemExplainer />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3 border-t border-border pt-6">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              The Confidential Market Reality Report
            </p>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Executive Summary — real report-over-report grade movement plus
              credit for any data actually added since the last report,
              generated in the same LLM call as everything else below (see
              market-reality-report.ts's "Report-over-report change" prompt
              block) — never a separate, additional cost. Null on reports
              generated before this field existed. */}
          {report.executiveSummary !== null && (
            <div className="mt-6">
              <SectionHeading>Executive Summary</SectionHeading>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Where you stand
                  </p>
                  <div className="mt-1 space-y-1 text-foreground">
                    {(report.executiveSummary as unknown as ExecutiveSummary).improvementNarrative.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Do more of this
                  </p>
                  <div className="mt-1 space-y-1 text-foreground">
                    {(report.executiveSummary as unknown as ExecutiveSummary).whatToDoMore.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 1 — "Where you stand" (Report Structure Spec §3.1).
              `whereYouStand.grade` is the probability grade (Market Reality
              Redesign Part 1, scoring/market-reality/probability.ts) — the
              one candidate-facing value, computed at report-generation time
              and refreshed weekly by the calibration cron. Reads live from
              MarketRealityComponentScore, never frozen into the report row —
              see market-reality-sections.ts. The old six-category "Your
              Grades" breakdown (MarketRealityReport.dossierGradeAtGeneration)
              is dead code — never populated by anything in this codebase —
              this section is the only candidate-facing standing. */}
          <div className="mt-10 border-t border-border pt-8">
            <SectionHeading>Where you stand</SectionHeading>
            {!whereYouStand ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Not enough data yet for your Market Reality Grade — upload a resume to get your
                first read.
              </p>
            ) : (
              <div className="mt-4">
                <p className={cn('text-5xl font-bold tabular-nums', GRADE_TEXT_COLOR[whereYouStand.grade])}>
                  {whereYouStand.grade}
                  <span className="ml-2 align-middle text-base font-medium text-muted-foreground">
                    {GRADE_LABEL[whereYouStand.grade]}
                  </span>
                  <EstimateTag />
                </p>
                <p className="mt-2 max-w-2xl text-sm text-foreground">
                  {whereYouStand.headline.strongestLine} {whereYouStand.headline.constraintLine}
                </p>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  This is a real, ongoing <strong className="font-semibold text-foreground">estimate of your per-attempt odds
                  of landing an interview</strong> — it moves as you actually apply and network, and it
                  recalibrates weekly against what really happens in your search. Blockers and
                  motivations you&apos;ve shared with your coach never factor into it.
                </p>
                {whereYouStand.gapReframing && (
                  <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-4">
                    <p className="text-sm font-semibold text-foreground">{whereYouStand.gapReframing.headline}</p>
                    <div className="mt-2 space-y-2">
                      {whereYouStand.gapReframing.body.map((paragraph, i) => (
                        <p key={i} className="text-sm text-muted-foreground">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-6 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Your starting point
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {whereYouStand.decomposition.map((d) => (
                    <div key={d.label} className="rounded-lg border border-border p-3 text-sm">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {d.label}
                      </p>
                      <p className={cn('mt-1 font-semibold tabular-nums', GRADE_TEXT_COLOR[d.grade])}>
                        {d.grade}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{d.note}</p>
                    </div>
                  ))}
                </div>
                {rubric && (
                  <div className="mt-4 rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-foreground">
                      Candidates at your starting point typically need about{' '}
                      <strong className="font-semibold">{rubric.applicationsPerInterview} applications</strong> or{' '}
                      <strong className="font-semibold">{rubric.conversationsPerInterview} real conversations</strong> to
                      generate one interview.
                      <EstimateTag />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      A rolling estimate over your last {rubric.rollingWindowWeeks} weeks, not a fixed rule — it
                      updates as your own results come in.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2 — "What's working" (spec §3.2). Reuses the existing
              strengths field unchanged — already specific/evidenced by
              design, already capped at 3-5 (marketRealityReportSchema). */}
          <div className="mt-10 border-t border-border pt-8">
            <SectionHeading>What&apos;s working</SectionHeading>
            <ul className="mt-4 space-y-3">
              {(report.strengths as unknown as Strength[]).map((s) => (
                <li key={s.title}>
                  <p className="font-semibold text-foreground">{s.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Areas for improvement — mirrors "What's working" exactly, just
              reading report.weaknesses instead of report.strengths. Both
              fields are generated together by the same LLM call
              (marketRealityReportSchema requires 2-5 of each) — this was
              already persisted on every report, just never rendered. */}
          <div className="mt-10 border-t border-border pt-8">
            <SectionHeading>Areas for improvement</SectionHeading>
            <ul className="mt-4 space-y-3">
              {(report.weaknesses as unknown as Strength[]).map((w) => (
                <li key={w.title}>
                  <p className="font-semibold text-foreground">{w.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{w.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* SECTION 3 — "What to fix on your resume" (spec §3.3). Ordered
              by point impact, straight from ResumeAnalysis.dimensionFindings
              — no LLM call. Rewrites (before/after) shown side by side where
              one was generated and self-checked against the real quote. */}
          {resumeFixes && (
            <div className="mt-10 border-t border-border pt-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionHeading>What to fix on your resume</SectionHeading>
                {resumeFixes.items.length > 0 && (
                  <Link
                    href="/dashboard/resume#resume-fixes"
                    className="text-sm font-medium text-primary underline underline-offset-4"
                  >
                    Fix these in the Resume Editor →
                  </Link>
                )}
              </div>
              {resumeFixes.items.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No high-impact issues found on your current resume — nice work.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-border">
                  {resumeFixes.items.map((item, i) => (
                    <div key={i} className="space-y-2 py-3 first:pt-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {item.dimension}
                      </p>
                      <p className="text-sm text-foreground">{item.whatsWrong}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Fix:</span> {item.fix}
                      </p>
                      {item.rewrite && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Before</p>
                            <p className="mt-1 text-sm text-foreground">{item.rewrite.before}</p>
                          </div>
                          <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                            <p className="text-xs font-medium text-success uppercase">After</p>
                            <p className="mt-1 text-sm text-foreground">{item.rewrite.after}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 4 — "How a recruiter will read this" (spec §3.4).
              Framed as interview prep, never as flaws. Recording an answer
              (ReviewerExplanationForm -> submitReviewerExplanation ->
              resolveReviewerDetection) removes the item immediately — this
              section reads live, unresolved rows only. Hidden entirely (not
              a filler message) when there's nothing real to show. */}
          {recruiterReadItems.length > 0 && (
            <div className="mt-10 border-t border-border pt-8">
              <SectionHeading>How a recruiter will read this</SectionHeading>
              <div className="mt-4 divide-y divide-border">
                {recruiterReadItems.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0">
                    <p className="text-sm text-foreground">{item.whatAReviewerNotices}</p>
                    <ReviewerExplanationForm
                      id={item.id}
                      placeholder={item.followUpPrompt}
                      detectionType={item.detectionType}
                      detectedContext={item.detectedContext}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 5 — "Getting past the filters" (spec §3.5/§4). A
              matrix, not a score. Hidden entirely (not a filler nudge) until
              a resume has actually been parsed into an ATS matrix. */}
          {atsMatrix && (
            <div className="mt-10 border-t border-border pt-8">
              <SectionHeading>Getting past the filters</SectionHeading>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Most resumes are filtered by an applicant tracking system before a person reads them.</li>
                <li>This is a <strong className="font-semibold text-foreground">mechanical hurdle</strong>, not a comment on you — every candidate clears the same check.</li>
              </ul>
              <div className="mt-4 space-y-3">
                {atsMatrix.cleanParsers.length > 0 && (
                  <p className="text-sm text-foreground">
                    <span className="font-medium text-success">Parses cleanly:</span>{' '}
                    {atsMatrix.cleanParsers.join(', ')}
                  </p>
                )}
                {atsMatrix.issues.map((issue) => (
                  <div key={issue.parserLabel} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">
                      {issue.parserLabel}{' '}
                      <span className={cn('text-xs font-normal', issue.severity === 'FAILING' ? 'text-error' : 'text-warning')}>
                        ({issue.severity === 'FAILING' ? 'largely fails to parse' : 'partial parse'})
                      </span>
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                      {issue.failures.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next steps — personalization checklist (day-one setup, in
              scope) plus a single lightweight Dossier-progress teaser.
              Evidence/Effort content itself (the six "what else moves the
              needle" levers, weekly Effort strategy) has moved to the
              Portfolio page — this report stays scoped to job goals, red
              flags, personalization, and resume. */}
          <div className="mt-10 border-t border-border pt-8">
            <SectionHeading>Next steps</SectionHeading>
            <ul className="mt-4 space-y-2 text-sm">
              {personalizationSteps.map((step) =>
                step.done ? (
                  <li key={step.key} className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-success" aria-hidden>✓</span>
                    <span className="line-through">{step.label}</span>
                  </li>
                ) : (
                  <li key={step.key}>
                    <Link
                      href={step.href}
                      className="flex items-center gap-2 text-foreground underline-offset-4 hover:underline"
                    >
                      <span className="text-muted-foreground" aria-hidden>○</span>
                      {step.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
            <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
              Beyond this, your{' '}
              <strong className="font-semibold text-foreground">Executive Dossier</strong> is{' '}
              <span className="font-semibold text-foreground tabular-nums">
                {dossierCompleteness.metCount} of {dossierCompleteness.totalCount}
              </span>{' '}
              steps complete — built from real work over time (references, networking, and more),
              separate from this grade.{' '}
              <Link href="/dashboard/portfolio" className="text-primary underline underline-offset-4">
                See what moves it →
              </Link>
            </p>
          </div>

          {/* SECTION 7 — "Your next week" (spec §3.7). Reuses the existing
              Search Action Task list (getSuggestedActions), which already
              flattens this report's own actionPlan field and feeds the
              Weekly Search Sprint. */}
          <div className="mt-10 border-t border-border pt-8 print:hidden">
            <SectionHeading>Your next week</SectionHeading>
            <p className="mt-4 text-sm text-muted-foreground">
              Everything below is a real, available action that counts toward this week&apos;s effort.
              Click into your{' '}
              <Link href="/dashboard" className="text-primary underline underline-offset-4">
                Search Sprint
              </Link>{' '}
              to define your weekly goal by Monday night — if you don&apos;t, I&apos;ll set an
              A-level goal for you automatically.
            </p>
            {suggestedActions.length === 0 ? (
              <InlineLoadingState label="Your suggested activities are still generating — check back in a moment." className="mt-3" />
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {suggestedActions.map((action, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-foreground">{action.text}</span>
                    {action.isAStandard && (
                      <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        Earns your A
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Suspense fallback={null}>
            <SearchStrategyGuidanceSection candidateId={profile.id} />
          </Suspense>


          {/* What's My Pattern — reactions to surfaced matches plus jobs
              added and applied to directly, read together. */}
          {report.jobSearchPattern !== null && (
            <div className="mt-10 border-t border-border pt-8">
              <SectionHeading>What&apos;s My Pattern</SectionHeading>
              {(report.jobSearchPattern as unknown as JobSearchPatternData).summary ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {(report.jobSearchPattern as unknown as JobSearchPatternData).summary}
                </p>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Not enough signal yet to spot a real pattern. Apply to companies and review the
                  jobs we tailor for you on the{' '}
                  <Link href="/dashboard/find-my-job" className="text-primary underline underline-offset-4">
                    Jobs
                  </Link>{' '}
                  page — reviewing{' '}
                  {(report.jobSearchPattern as unknown as JobSearchPatternData).minRequired} or more
                  helps us train Victoria to get to know what you&apos;re really looking for.
                </p>
              )}
            </div>
          )}

          {/* Application Trends — focused vs. scattered across function,
              industry, and geography, plus whether the application pace is
              too slow, healthy, or spray-and-pray. */}
          {(report.jobSearchPattern as unknown as JobSearchPatternData | null)?.applicationTrends && (
            <div className="mt-10 border-t border-border pt-8">
              <SectionHeading>Application Trends</SectionHeading>
              {(() => {
                const trends = (report.jobSearchPattern as unknown as JobSearchPatternData).applicationTrends!
                if (!trends.eligible) {
                  return (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Not enough applications yet to spot a trend — once you&apos;ve applied to{' '}
                      {trends.minRequired} or more jobs, this will show whether you&apos;re staying
                      focused and applying at a healthy pace.
                    </p>
                  )
                }
                return (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {trends.functionFocus && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Job function
                          </p>
                          <p className="mt-1 text-sm text-foreground">{FOCUS_LABEL[trends.functionFocus]}</p>
                          {trends.functionBreakdown && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {trends.functionBreakdown.map((b) => `${b.label} (${b.count})`).join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                      {trends.industryFocus && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Industry
                          </p>
                          <p className="mt-1 text-sm text-foreground">{FOCUS_LABEL[trends.industryFocus]}</p>
                          {trends.industryBreakdown && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {trends.industryBreakdown.map((b) => `${b.label} (${b.count})`).join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                      {trends.geographyFocus && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Geography
                          </p>
                          <p className="mt-1 text-sm text-foreground">{FOCUS_LABEL[trends.geographyFocus]}</p>
                          {trends.geographyBreakdown && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {trends.geographyBreakdown.map((b) => `${b.label} (${b.count})`).join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                      {trends.volumeAssessment && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Application pace
                          </p>
                          <p className="mt-1 text-sm text-foreground">
                            {VOLUME_ASSESSMENT_LABEL[trends.volumeAssessment]}
                            {trends.applicationsPerWeek !== null && ` — ${trends.applicationsPerWeek}/week`}
                          </p>
                          {trends.volumeGoalPerWeek && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Your goal: {trends.volumeGoalPerWeek}/week
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {(!trends.industryBreakdown || !trends.geographyBreakdown) && (
                      <p className="text-xs text-muted-foreground">
                        Industry and geography need more of your applications to have a company name or
                        a fit check run — they&apos;ll fill in as you add more.
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
