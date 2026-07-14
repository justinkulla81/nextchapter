import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { regenerateHireabilityReport, resendMyHireabilityReportEmail } from './actions'
import { Button } from '@/components/ui/button'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { EmailConfirmationBanner } from '@/components/dashboard/EmailConfirmationBanner'
import { countCompletedTasks, TASKS_REQUIRED_TO_REGENERATE_REPORT } from '@/lib/dashboard/completed-tasks'
import { generateHireabilityReport } from '@/lib/reports/hireability-report'
import { sendHireabilityReportEmail } from '@/lib/email/send-hireability-report'
import { hasStartedSprint } from '@/lib/weekly/sprint'
import type { HireabilityGrade, Grade } from '@/lib/scoring/grade'
import { GRADE_LABEL, FACTOR_TYPE_LABEL, CONFIDENCE_LABEL, CONFIDENCE_STYLE } from '@/lib/scoring/grade'
import { GradeSystemExplainer } from '@/components/dashboard/GradeSystemExplainer'
import { cn } from '@/lib/utils'

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
  const searchExecutionAvailable = await hasStartedSprint(profile.id)

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
          <h1 className="text-2xl font-semibold tracking-tight">My Report</h1>
          <p className="mt-1 text-muted-foreground">
            Your strengths, gaps, and a 7-day plan — built from everything in your profile.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {report && (
            <>
              <PrintReportButton />
              {!report.emailSentAt && (
                <form action={resendMyHireabilityReportEmail}>
                  <Button type="submit" variant="outline">
                    Email me this report
                  </Button>
                </form>
              )}
            </>
          )}
          {canRegenerate && (
            <form action={regenerateHireabilityReport}>
              <Button type="submit" variant="outline">
                Regenerate my report
              </Button>
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

          {/* Executive Summary — Hireability Grade */}
          <div className="mt-8">
            <SectionHeading>Your Hireability Grade</SectionHeading>
            {report.hireabilityGradeAtGeneration === null ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Grade breakdown unavailable for this report — regenerate to see it.
              </p>
            ) : (
              (() => {
                const grade = report.hireabilityGradeAtGeneration as unknown as HireabilityGrade
                return (
                  <div className="mt-4 grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                        Market Reality
                      </p>
                      <p className={cn('text-5xl font-bold tabular-nums', GRADE_COLOR[grade.marketReality.grade])}>
                        {grade.marketReality.grade}
                        <span className="ml-2 align-middle text-base font-medium text-muted-foreground">
                          {GRADE_LABEL[grade.marketReality.grade]}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Your honest market position — some of this you control, some you don&apos;t.
                      </p>
                      <div className="mt-3 space-y-1.5">
                        {grade.marketReality.dimensions.map((d) => (
                          <div key={d.key} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-foreground">{d.label}</span>
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-[10px] font-medium',
                                  CONFIDENCE_STYLE[d.confidence]
                                )}
                              >
                                {CONFIDENCE_LABEL[d.confidence]}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {FACTOR_TYPE_LABEL[d.factorType]}
                              </span>
                              <span className={cn('font-semibold tabular-nums', GRADE_COLOR[d.grade])}>
                                {d.grade}
                              </span>
                            </span>
                          </div>
                        ))}
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
          </div>

          {/* Grade System Explainer */}
          <div className="mt-10 border-t border-border pt-8 print:hidden">
            <SectionHeading>Understanding your grades</SectionHeading>
            <div className="mt-4">
              <GradeSystemExplainer />
            </div>
          </div>

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

          {/* Action Plan pointer */}
          <div className="mt-10 border-t border-border pt-8 print:hidden">
            <SectionHeading>7-Day Action Plan</SectionHeading>
            <p className="mt-4 text-sm text-muted-foreground">
              See your current, live action plan on the{' '}
              <Link href="/dashboard" className="text-primary underline underline-offset-4">
                Success Dashboard →
              </Link>
            </p>
          </div>

          {/* Gap Analysis */}
          <div className="mt-10 border-t border-border pt-8">
            <SectionHeading>
              Gap Analysis — {(report.gapAnalysis as unknown as GapAnalysis).targetRole}
            </SectionHeading>
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

          {/* Resume */}
          <div className="mt-10 border-t border-border pt-8 print:hidden">
            <SectionHeading>Resume</SectionHeading>
            {profile.resumes.length === 0 ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t uploaded a resume yet. Uploading one massively improves your
                  score and lets us give you specific, evidence-based suggestions as part of your
                  action plan.
                </p>
                <Button render={<Link href="/dashboard/resume" />}>Upload my resume</Button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Resume on file — see your full analysis on the{' '}
                <Link href="/dashboard/resume" className="text-primary underline underline-offset-4">
                  Resume page
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
