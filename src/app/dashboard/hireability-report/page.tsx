import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { regenerateHireabilityReport, resendMyHireabilityReportEmail } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { EmailConfirmationBanner } from '@/components/dashboard/EmailConfirmationBanner'
import { countCompletedTasks, TASKS_REQUIRED_TO_REGENERATE_REPORT } from '@/lib/dashboard/completed-tasks'
import { generateHireabilityReport } from '@/lib/reports/hireability-report'
import { sendHireabilityReportEmail } from '@/lib/email/send-hireability-report'
import { hasStartedSprint, getSuggestedActions } from '@/lib/weekly/sprint'
import { weeklyTimeTargetHours } from '@/lib/weekly/weekly-target'
import type { HireabilityGrade, Grade } from '@/lib/scoring/grade'
import { GRADE_LABEL, FACTOR_TYPE_LABEL } from '@/lib/scoring/grade'
import { GradeSystemExplainer } from '@/components/dashboard/GradeSystemExplainer'
import { CoachingCTACard } from '@/components/dashboard/CoachingCTACard'
import { isAtOrBelowGrade } from '@/lib/coaching/grade-threshold'
import { cn } from '@/lib/utils'

// A first-ever report has essentially no track record behind it yet — an F
// at that point reflects thin signal, not a real verdict, so it's shown as
// N/A instead until a second report exists to actually compare against.
function displayGrade(grade: Grade, isFirstReport: boolean): Grade | 'N/A' {
  return isFirstReport && grade === 'F' ? 'N/A' : grade
}

const GRADE_COLOR: Record<Grade, string> = {
  A: 'text-success',
  B: 'text-brand',
  C: 'text-light-blue',
  D: 'text-warning',
  F: 'text-error',
}

interface Strength {
  title: string
  detail: string
}

interface Gap {
  area: string
  why: string
  remediation: string
  remediationType: string
}

interface GapAnalysis {
  targetRole: string
  gaps: Gap[]
}

interface MarketConditions {
  narrative: string[]
}

interface HillToClimb {
  tone: 'very_positive' | 'positive_with_work' | 'significant_climb'
  narrative: string[]
}

const HILL_TO_CLIMB_LABELS: Record<HillToClimb['tone'], string> = {
  very_positive: 'You are well positioned',
  positive_with_work: 'A solid path, with real work ahead',
  significant_climb: 'A genuinely hard climb — but not an impossible one',
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-widest text-brand uppercase">{children}</h2>
  )
}

export default async function HireabilityReportPage() {
  const profile = await getDashboardData()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let report = await prisma.hireabilityReport.findFirst({
    where: { candidateId: profile.id },
    orderBy: { generatedAt: 'desc' },
  })

  // Normally generated as a fire-and-forget side effect of the first
  // dashboard load after registration (see getDashboardData's justRegistered
  // branch). If this page is reached before that's finished — or it failed
  // silently — don't leave the candidate stuck on "check back in a moment"
  // forever; generate it directly, here, on demand.
  if (!report) {
    try {
      await generateHireabilityReport(profile.id)
      report = await prisma.hireabilityReport.findFirst({
        where: { candidateId: profile.id },
        orderBy: { generatedAt: 'desc' },
      })
    } catch (error) {
      console.error('Failed to generate hireability report on demand:', error)
    }
  }
  // See dashboard/page.tsx's identical fallback — the registration-time
  // after() callback that normally generates AND emails this report can get
  // cut off before the email step ever runs, leaving a real, generated
  // report permanently unsent. Close that gap on every load, not just the
  // first — this is what actually fixes it for reports that already exist.
  if (report && !report.emailSentAt) {
    await sendHireabilityReportEmail(profile.id)
  }

  const completedTasks = countCompletedTasks(profile)
  const canRegenerate = completedTasks >= TASKS_REQUIRED_TO_REGENERATE_REPORT
  const [searchExecutionAvailable, priorReportCount, suggestedActions] = await Promise.all([
    hasStartedSprint(profile.id),
    prisma.hireabilityReport.count({
      where: { candidateId: profile.id, generatedAt: { lt: report?.generatedAt ?? new Date() } },
    }),
    getSuggestedActions(profile.id),
  ])
  const isFirstReport = priorReportCount === 0
  const weekNumber = profile._count.weeklySprints + 1

  const gradeAtGeneration = report?.hireabilityGradeAtGeneration as unknown as HireabilityGrade | null
  const showCoachingCTA =
    !!gradeAtGeneration &&
    isAtOrBelowGrade(gradeAtGeneration.marketReality.grade, 'C') &&
    isAtOrBelowGrade(gradeAtGeneration.searchExecution.grade, 'C')
  const aTargetHours = weeklyTimeTargetHours(weekNumber)
  const bTargetHours = Math.round(aTargetHours * 0.75 * 10) / 10

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
          <h1 className="text-2xl font-semibold tracking-tight">Hireability Report</h1>
          <p className="mt-1 text-muted-foreground">
            Your strengths, gaps, and an action plan — built from everything in your profile.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {report && (
            <>
              <PrintReportButton />
              {!report.emailSentAt && (
                <form action={resendMyHireabilityReportEmail}>
                  <SubmitButton variant="outline" pendingLabel="Sending…">
                    Email me this report
                  </SubmitButton>
                </form>
              )}
            </>
          )}
          {canRegenerate && (
            <form action={regenerateHireabilityReport}>
              <SubmitButton variant="outline" pendingLabel="Regenerating…">
                Regenerate my report
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {!canRegenerate && (
        <p className="text-sm text-muted-foreground print:hidden">
          Your report is a snapshot — you can regenerate it once you&apos;ve completed{' '}
          {TASKS_REQUIRED_TO_REGENERATE_REPORT} tasks from your action plan (
          {completedTasks}/{TASKS_REQUIRED_TO_REGENERATE_REPORT} so far).
        </p>
      )}

      {!report ? (
        <p className="text-sm text-muted-foreground">
          Your report is generating — check back in a moment.
        </p>
      ) : (
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-white p-8 shadow-sm sm:p-12">
          {/* Letterhead */}
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-navy pb-6">
            <div>
              <p className="text-2xl font-bold tracking-tight text-navy">NextChapter</p>
              <p className="mt-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Hireability Report
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

          {/* Grade System Explainer — first, so the grades below are read in context */}
          <div className="mt-8 border-t border-border pt-8 print:hidden">
            <SectionHeading>Understanding your grades</SectionHeading>
            <div className="mt-4">
              <GradeSystemExplainer />
            </div>
          </div>

          {/* Executive Summary — Hireability Grade */}
          <div className="mt-10 border-t border-border pt-8">
            <SectionHeading>Your Hireability Grade</SectionHeading>
            {report.hireabilityGradeAtGeneration === null ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Grade breakdown unavailable for this report — regenerate to see it.
              </p>
            ) : (
              (() => {
                const grade = report.hireabilityGradeAtGeneration as unknown as HireabilityGrade
                const marketRealityDisplay = displayGrade(grade.marketReality.grade, isFirstReport)
                return (
                  <div className="mt-4 grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                        Market Reality
                      </p>
                      <p
                        className={cn(
                          'text-5xl font-bold tabular-nums',
                          marketRealityDisplay === 'N/A' ? 'text-muted-foreground' : GRADE_COLOR[marketRealityDisplay]
                        )}
                      >
                        {marketRealityDisplay}
                        <span className="ml-2 align-middle text-base font-medium text-muted-foreground">
                          {marketRealityDisplay === 'N/A' ? 'Not enough signal yet' : GRADE_LABEL[marketRealityDisplay]}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {marketRealityDisplay === 'N/A'
                          ? "This is your first report — there's not enough real signal yet for a fair grade here. It'll sharpen as you add more."
                          : "Your honest market position — some of this you control, some you don't."}
                      </p>
                      <div className="mt-3 space-y-1.5">
                        {grade.marketReality.dimensions.map((d) => {
                          const dimensionDisplay = displayGrade(d.grade, isFirstReport)
                          return (
                            <div key={d.key} className="flex items-center justify-between gap-2 text-sm">
                              <span className="text-foreground">{d.label}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {FACTOR_TYPE_LABEL[d.factorType]}
                                </span>
                                <span
                                  className={cn(
                                    'font-semibold tabular-nums',
                                    dimensionDisplay === 'N/A' ? 'text-muted-foreground' : GRADE_COLOR[dimensionDisplay]
                                  )}
                                >
                                  {dimensionDisplay}
                                </span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                        Search Execution
                      </p>
                      {!searchExecutionAvailable ? (
                        <>
                          <p className="mt-1 text-5xl font-bold text-muted-foreground">N/A</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            You haven&apos;t started your Success Sprint yet — that&apos;s not a
                            failure, it&apos;s a starting line. Commit to this week&apos;s goals and
                            I&apos;ll grade your execution this Sunday.
                          </p>
                        </>
                      ) : (
                        <>
                          <p
                            className={cn(
                              'text-5xl font-bold tabular-nums',
                              GRADE_COLOR[grade.searchExecution.grade]
                            )}
                          >
                            {grade.searchExecution.grade}
                            <span className="ml-2 align-middle text-base font-medium text-muted-foreground">
                              {GRADE_LABEL[grade.searchExecution.grade]}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            How well you&apos;re running your search — everyone can bring this one
                            to an A.
                          </p>
                          <div className="mt-3 space-y-1.5">
                            {grade.searchExecution.engines.map((e) => (
                              <div key={e.key} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-foreground">{e.label} Engine</span>
                                <span className={cn('font-semibold tabular-nums', GRADE_COLOR[e.grade])}>
                                  {e.grade}
                                </span>
                              </div>
                            ))}
                          </div>
                          {!grade.searchExecution.categoryMinimumsMet && (
                            <p className="mt-3 text-xs font-medium text-foreground">
                              Capped at B — an A now requires real work across all four engines, not
                              just one.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })()
            )}
            <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
              Everyone will not make it — but doing the real work meaningfully improves your odds.
              It&apos;s all about your Search Execution: the one grade above that&apos;s entirely
              in your hands.
            </p>
            <div className="mt-4 rounded-lg border border-brand/20 bg-brand/5 p-4">
              <p className="text-sm font-medium text-foreground">
                This week, to get an A on Search Execution, it takes about{' '}
                <span className="font-semibold">{aTargetHours}h</span> of real committed work; a B
                takes about{' '}
                <span className="font-semibold">{bTargetHours}h</span>.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                That target grows a little each week through Week 6, then holds steady — see your{' '}
                <Link href="/dashboard/sprint" className="text-primary underline underline-offset-4">
                  Success Sprint
                </Link>{' '}
                for this week&apos;s exact commitment.
              </p>
            </div>
          </div>

          {showCoachingCTA && (
            <div className="mt-6">
              <CoachingCTACard />
            </div>
          )}

          {/* Strengths */}
          <div className="mt-10 border-t border-border pt-8">
            <SectionHeading>Strengths</SectionHeading>
            <div className="mt-4 divide-y divide-border">
              {(report.strengths as unknown as Strength[]).map((s) => (
                <div key={s.title} className="py-3 first:pt-0">
                  <p className="font-semibold text-foreground">{s.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Weaknesses */}
          <div className="mt-10 border-t border-border pt-8">
            <SectionHeading>Weaknesses — an honest look in the mirror</SectionHeading>
            <div className="mt-4 divide-y divide-border">
              {(report.weaknesses as unknown as Strength[]).map((w) => (
                <div key={w.title} className="py-3 first:pt-0">
                  <p className="font-semibold text-foreground">{w.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{w.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hill to Climb */}
          {report.hillToClimb !== null && (
            <div className="mt-10 border-t border-border pt-8">
              <SectionHeading>How Hard Will This Be?</SectionHeading>
              <p
                className={cn(
                  'mt-4 font-semibold',
                  (report.hillToClimb as unknown as HillToClimb).tone === 'very_positive' &&
                    'text-success',
                  (report.hillToClimb as unknown as HillToClimb).tone === 'significant_climb' &&
                    'text-brand'
                )}
              >
                {HILL_TO_CLIMB_LABELS[(report.hillToClimb as unknown as HillToClimb).tone]}
              </p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {(report.hillToClimb as unknown as HillToClimb).narrative.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* Gap Analysis */}
          <div className="mt-10 border-t border-border pt-8">
            <SectionHeading>Gap Analysis for your Ideal Role</SectionHeading>
            <div className="mt-4 divide-y divide-border">
              {(report.gapAnalysis as unknown as GapAnalysis).gaps.map((gap) => (
                <div key={gap.area} className="space-y-1 py-3 first:pt-0">
                  <p className="font-semibold text-foreground">{gap.area}</p>
                  <p className="text-sm text-muted-foreground">{gap.why}</p>
                  <p className="text-sm">
                    <span className="font-medium">Remediation ({gap.remediationType}):</span>{' '}
                    {gap.remediation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Your Success Sprint — the same list the Success Sprint page draws from */}
          <div className="mt-10 border-t border-border pt-8 print:hidden">
            <SectionHeading>Your Success Sprint – Week&apos;s Activities</SectionHeading>
            <p className="mt-4 text-sm text-muted-foreground">
              Everything below is a real, available action toward your Search Execution grade.
              Click into your{' '}
              <Link href="/dashboard/sprint" className="text-primary underline underline-offset-4">
                Success Sprint
              </Link>{' '}
              to define your weekly goal by Monday night — if you don&apos;t, I&apos;ll set an
              A-level goal for you automatically.
            </p>
            {suggestedActions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Your suggested activities are still generating — check back in a moment.
              </p>
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

          {/* Market Conditions */}
          {report.marketConditions !== null && (
            <div className="mt-10 border-t border-border pt-8">
              <SectionHeading>Market Conditions</SectionHeading>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {(report.marketConditions as unknown as MarketConditions).narrative.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
