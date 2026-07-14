import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import type { HireabilityGrade, Grade } from '@/lib/scoring/grade'
import { GRADE_LABEL } from '@/lib/scoring/grade'
import { cn } from '@/lib/utils'

const GRADE_COLOR: Record<Grade, string> = {
  A: 'text-success',
  B: 'text-brand',
  C: 'text-light-blue',
  D: 'text-warning',
  F: 'text-error',
}

const FACTOR_TYPE_LABEL: Record<string, string> = {
  controllable: 'Controllable',
  influenceable: 'Influenceable',
  structural: 'Structural',
}

interface Strength {
  title: string
  detail: string
}

interface Observations {
  motivationReading: string
  progressPatterns: string
  dataInconsistency: string | null
}

interface SuggestedActionItem {
  text: string
  actionType?: string
  isAStandard: boolean
  isStretch?: boolean
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold tracking-widest text-brand uppercase">{children}</h2>
}

function gradeChangeLabel(current: { grade: Grade; score: number }, previous: { grade: Grade; score: number } | null) {
  if (!previous) return null
  const diff = current.score - previous.score
  if (Math.abs(diff) < 2) return '— steady vs. last week'
  return diff > 0 ? `↑ up from ${previous.grade} last week` : `↓ down from ${previous.grade} last week`
}

export default async function WeeklyReportPage() {
  const profile = await getDashboardData()

  const report = await prisma.sundayNightReport.findFirst({
    where: { candidateId: profile.id },
    orderBy: { generatedAt: 'desc' },
  })

  const candidateName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Candidate'

  if (!report) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sunday Night Report</h1>
          <p className="mt-1 text-muted-foreground">
            Your first weekly report arrives once your first Success Sprint week wraps up.
          </p>
        </div>
        <Link href="/dashboard/sprint" className="inline-block text-sm font-medium text-primary underline underline-offset-4">
          Set up this week&apos;s Success Sprint →
        </Link>
      </div>
    )
  }

  const grade = report.gradeSnapshot as unknown as HireabilityGrade
  const previousGrade = report.previousGradeSnapshot as unknown as HireabilityGrade | null
  const isFirstWeek = previousGrade === null
  const strengths = report.strengths as unknown as Strength[]
  const weaknesses = report.weaknesses as unknown as Strength[]
  const observations = report.observations as unknown as Observations
  const suggestedActionPlan = report.suggestedActionPlan as unknown as SuggestedActionItem[]
  const preparedDate = new Date(report.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sunday Night Report</h1>
        <p className="mt-1 text-muted-foreground">Your weekly review from Victoria.</p>
      </div>

      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-white p-8 shadow-sm sm:p-12">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-navy pb-6">
          <div>
            <p className="text-2xl font-bold tracking-tight text-navy">NextChapter</p>
            <p className="mt-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Sunday Night Report
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Prepared for {candidateName}</p>
            <p>{preparedDate}</p>
          </div>
        </div>

        {/* Section 1: Hireability Grade */}
        <div className="mt-8">
          <SectionHeading>Your Hireability Grade</SectionHeading>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Market Reality</p>
              <p className={cn('text-4xl font-bold tabular-nums', GRADE_COLOR[grade.marketReality.grade])}>
                {grade.marketReality.grade}
                <span className="ml-2 align-middle text-sm font-medium text-muted-foreground">
                  {GRADE_LABEL[grade.marketReality.grade]}
                </span>
              </p>
              {previousGrade && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {gradeChangeLabel(grade.marketReality, previousGrade.marketReality)}
                </p>
              )}
              <div className="mt-3 space-y-1.5">
                {grade.marketReality.dimensions.map((d) => (
                  <div key={d.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-foreground">{d.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{FACTOR_TYPE_LABEL[d.factorType]}</span>
                      <span className={cn('font-semibold tabular-nums', GRADE_COLOR[d.grade])}>{d.grade}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Search Execution</p>
              {isFirstWeek ? (
                <>
                  <p className="text-4xl font-bold tabular-nums text-muted-foreground">N/A</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You haven&apos;t started your sprint yet — that&apos;s not a failure, it&apos;s a starting line.
                    Complete this week&apos;s actions and I&apos;ll grade your execution next Sunday. The grade is
                    entirely yours to earn. — Victoria
                  </p>
                </>
              ) : (
                <>
                  <p className={cn('text-4xl font-bold tabular-nums', GRADE_COLOR[grade.searchExecution.grade])}>
                    {grade.searchExecution.grade}
                    <span className="ml-2 align-middle text-sm font-medium text-muted-foreground">
                      {GRADE_LABEL[grade.searchExecution.grade]}
                    </span>
                  </p>
                  {previousGrade && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {gradeChangeLabel(grade.searchExecution, previousGrade.searchExecution)}
                    </p>
                  )}
                  <div className="mt-3 space-y-1.5">
                    {grade.searchExecution.engines.map((e) => (
                      <div key={e.key} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-foreground">{e.label} Engine</span>
                        <span className={cn('font-semibold tabular-nums', GRADE_COLOR[e.grade])}>{e.grade}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Last Week's Work (Week 2+ only) */}
        {!isFirstWeek && (
          <div className="mt-10 border-t border-border pt-8">
            <SectionHeading>Last Week&apos;s Work</SectionHeading>
            <p className="mt-4 text-sm text-foreground">
              You committed to {report.lastWeekCommittedCount} action
              {report.lastWeekCommittedCount === 1 ? '' : 's'}. You completed{' '}
              {report.lastWeekCompletedCount}.
            </p>
            {report.lastWeekCompletedTexts.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-foreground">Completed</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {report.lastWeekCompletedTexts.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.lastWeekSkippedTexts.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-foreground">Skipped</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {report.lastWeekSkippedTexts.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              Check-in streak: {profile.currentStreak} day{profile.currentStreak === 1 ? '' : 's'}
            </p>
          </div>
        )}

        {/* Section 3: Strengths & Weaknesses */}
        <div className="mt-10 border-t border-border pt-8">
          <SectionHeading>Strengths &amp; Weaknesses</SectionHeading>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Strengths</p>
              <div className="mt-2 space-y-3">
                {strengths.map((s) => (
                  <div key={s.title}>
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-sm text-muted-foreground">{s.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Weaknesses</p>
              <div className="mt-2 space-y-3">
                {weaknesses.map((w) => (
                  <div key={w.title}>
                    <p className="text-sm font-medium text-foreground">{w.title}</p>
                    <p className="text-sm text-muted-foreground">{w.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Victoria's Observations */}
        <div className="mt-10 border-t border-border pt-8">
          <SectionHeading>Victoria&apos;s Observations</SectionHeading>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Motivation reading</p>
              <p className="text-sm text-muted-foreground">{observations.motivationReading}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Progress patterns</p>
              <p className="text-sm text-muted-foreground">{observations.progressPatterns}</p>
            </div>
            {observations.dataInconsistency && (
              <div>
                <p className="text-sm font-medium text-foreground">Worth paying attention to</p>
                <p className="text-sm text-muted-foreground">{observations.dataInconsistency}</p>
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Straight Talk */}
        <div className="mt-10 border-t border-border pt-8">
          <SectionHeading>Straight Talk</SectionHeading>
          <p className="mt-4 font-medium text-foreground">{report.straightTalk}</p>
        </div>

        {/* Section 6: This Week's Action Plan */}
        <div className="mt-10 border-t border-border pt-8">
          <SectionHeading>This Week&apos;s Action Plan</SectionHeading>
          <p className="mt-4 text-sm text-muted-foreground">
            To earn your A this week: complete{' '}
            {suggestedActionPlan
              .filter((a) => a.isAStandard)
              .map((a) => a.text)
              .join(', ')}
            . Everything else is a bonus.
          </p>
          <div className="mt-4 divide-y divide-border">
            {suggestedActionPlan.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                <p className="text-sm text-foreground">{item.text}</p>
                {item.isAStandard && (
                  <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    Earns your A
                  </span>
                )}
                {item.isStretch && (
                  <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                    Stretch
                  </span>
                )}
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/sprint"
            className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            Commit to this week&apos;s goals →
          </Link>
        </div>

        {/* Section 7: The A-List */}
        <div className="mt-10 border-t border-border pt-8 print:hidden">
          <SectionHeading>The A-List</SectionHeading>
          {report.onAList ? (
            <p className="mt-4 text-sm text-foreground">
              You&apos;re on this week&apos;s A-List. You earned it. — Victoria
            </p>
          ) : (
            <p className="mt-4 text-sm text-foreground">
              This week&apos;s A-List: {report.aListCount} member{report.aListCount === 1 ? '' : 's'} earned their A
              {report.aListMemberNames.length > 0 && <> ({report.aListMemberNames.join(', ')})</>}. Complete your
              committed actions and reach a Search Execution A to make next week&apos;s list. — Vic
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
