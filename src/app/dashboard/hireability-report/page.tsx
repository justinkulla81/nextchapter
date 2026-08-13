import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { isSearchGoalsComplete } from '@/lib/search-strategy'
import { getOrDraftSearchStrategyGuidance, getSearchStrategyActions } from '@/lib/reports/search-strategy-guidance'
import { getOrDraftWeeklyFocus } from '@/lib/reports/weekly-focus'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { regenerateHireabilityReport, resendMyHireabilityReportEmail } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { InlineLoadingState } from '@/components/ui/spinner'
import { StatusIcon } from '@/components/ui/status-icon'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { EmailConfirmationBanner } from '@/components/dashboard/EmailConfirmationBanner'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { countCompletedTasks, TASKS_REQUIRED_TO_REGENERATE_REPORT } from '@/lib/dashboard/completed-tasks'
import { generateHireabilityReport } from '@/lib/reports/hireability-report'
import { sendHireabilityReportEmail } from '@/lib/email/send-hireability-report'
import { hasStartedSprint, getSuggestedActions, getMondayOfWeek, getCandidateWeekNumber } from '@/lib/weekly/sprint'
import { pointsNeededForA } from '@/lib/weekly/action-effort'
import type { Grade } from '@/lib/scoring/grade'
import { normalizeGradeSnapshot } from '@/lib/scoring/hireability-grade'
import { GRADE_LABEL, GRADE_TEXT_COLOR } from '@/lib/scoring/grade'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { GradeSystemExplainer } from '@/components/dashboard/GradeSystemExplainer'
import { CoachingCTACard } from '@/components/dashboard/CoachingCTACard'
import { isAtOrBelowGrade } from '@/lib/coaching/grade-threshold'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Market Reality Report' }


// A first-ever report has essentially no track record behind it yet — an F
// at that point reflects thin signal, not a real verdict, so it's shown as
// N/A instead until a second report exists to actually compare against.
function displayGrade(grade: Grade, isFirstReport: boolean): Grade | 'N/A' {
  return isFirstReport && grade === 'F' ? 'N/A' : grade
}

// Mirrors the "5 is on target" language already used on Search Strategy
// (SearchStrategyForm) and the Weekly Sprint's REFERENCE_ADDED row
// (SuccessSprintCard) — same threshold, same counting convention (COMPLETED
// only), just surfaced here too since this is the one place a candidate
// reads their actual grades and should see what's still backing them.
const REFERENCE_CONFIDENCE_TARGET = 5

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
      applicationVolumeGoal: true,
      isPivoting: true,
      interimConsultingInterest: true,
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
          <p className="mt-1 text-foreground">{guidance.pros}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-semibold tracking-wide text-warning uppercase">What to watch</p>
          <p className="mt-1 text-foreground">{guidance.cons}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-semibold tracking-wide text-brand uppercase">What I&apos;d change</p>
          <p className="mt-1 text-foreground">{guidance.suggestedChanges}</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">Specific actions to take:</p>
        <div className="mt-1.5 flex flex-col gap-2">
          {getSearchStrategyActions(candidate).map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground transition-colors hover:border-brand/40 hover:text-brand"
            >
              {action.label} →
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

const WEEKLY_FOCUS_SECTIONS: { key: 'increase' | 'adjust' | 'maintain' | 'startNew'; label: string; color: string }[] = [
  { key: 'increase', label: 'Do more of', color: 'text-success' },
  { key: 'adjust', label: 'Adjust', color: 'text-warning' },
  { key: 'maintain', label: 'Keep doing', color: 'text-brand' },
  { key: 'startNew', label: 'Start new', color: 'text-orange' },
]

// Reads the same self-cached weekly guidance the dashboard's WeeklyFocusCard
// shows — a cache hit in the common case, so this essentially never
// triggers a second Anthropic call for the same week. Isolated in its own
// Suspense boundary anyway, same reasoning as SearchStrategyGuidanceSection
// above. Renders nothing until the candidate has started a Search Sprint.
async function WeeklyFocusSection({ candidateId }: { candidateId: string }) {
  const focus = await getOrDraftWeeklyFocus(candidateId)
  if (!focus) return null

  return (
    <div className="mt-10 border-t border-border pt-8 print:hidden">
      <div className="flex items-center gap-3">
        <VictoriaAvatar size={36} />
        <SectionHeading>Victoria&apos;s Advice for Your Weekly Search Strategy</SectionHeading>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {WEEKLY_FOCUS_SECTIONS.map((section) => (
          <div key={section.key} className="rounded-lg border border-border bg-white p-4">
            <p className={`text-xs font-semibold tracking-wide uppercase ${section.color}`}>{section.label}</p>
            <p className="mt-1 text-sm text-foreground">{focus[section.key].text}</p>
            <p className="mt-3 text-sm text-foreground">
              <span className="font-semibold">Recommendation:</span> {focus[section.key].recommendation}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
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

interface HillToClimb {
  tone: 'very_positive' | 'positive_with_work' | 'significant_climb'
  narrative: string[]
}

interface ExecutiveSummary {
  improvementNarrative: string[]
  whatToDoMore: string[]
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

  const completedReferencesCount = profile.references.filter((r) => r.status === 'COMPLETED').length
  const completedTasks = countCompletedTasks(profile)
  const canRegenerate = completedTasks >= TASKS_REQUIRED_TO_REGENERATE_REPORT
  const weekNumber = await getCandidateWeekNumber(profile.id, getMondayOfWeek(new Date()))
  const [searchExecutionAvailable, priorReportCount, suggestedActions] = await Promise.all([
    hasStartedSprint(profile.id),
    prisma.hireabilityReport.count({
      where: { candidateId: profile.id, generatedAt: { lt: report?.generatedAt ?? new Date() } },
    }),
    getSuggestedActions(profile.id, weekNumber),
  ])
  const isFirstReport = priorReportCount === 0

  const gradeAtGeneration = normalizeGradeSnapshot(report?.hireabilityGradeAtGeneration)
  const showCoachingCTA = !!gradeAtGeneration && isAtOrBelowGrade(gradeAtGeneration.grade, 'C')
  // Derived from the same canonical Weekly Search Score points ramp everything
  // else reads from (1 point = 1 minute) — this used to be a separately
  // maintained hours target that had drifted out of sync with the points ramp.
  const aTargetHours = Math.round((pointsNeededForA(weekNumber) / 60) * 10) / 10
  const bTargetHours = Math.round(aTargetHours * 0.75 * 10) / 10
  const casuallySearching = isCasuallySearching(profile.jobSearchDifficultyLevel, profile.searchIntensity)

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

      <div className="print:hidden">
        <PageHeaderBoxes pageKey="hireability-report" candidateId={profile.id} />
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

          {/* Executive Summary — real report-over-report grade movement plus
              credit for any data actually added since the last report,
              generated in the same LLM call as everything else below (see
              hireability-report.ts's "Report-over-report change" prompt
              block) — never a separate, additional cost. Null on reports
              generated before this field existed. */}
          {report.executiveSummary !== null && (
            <div className="mt-8 border-t border-border pt-8">
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

          {/* Grade breakdown */}
          <div className="mt-10 border-t border-border pt-8">
            <SectionHeading>Your Grades</SectionHeading>
            {report.hireabilityGradeAtGeneration === null ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Grade breakdown unavailable for this report — regenerate to see it.
              </p>
            ) : (
              (() => {
                const grade = normalizeGradeSnapshot(report.hireabilityGradeAtGeneration)!
                const gradeDisplay = displayGrade(grade.grade, isFirstReport)
                return (
                  <div className="mt-4">
                    <p
                      className={cn(
                        'text-5xl font-bold tabular-nums',
                        gradeDisplay === 'N/A' ? 'text-muted-foreground' : GRADE_TEXT_COLOR[gradeDisplay]
                      )}
                    >
                      {gradeDisplay}
                      <span className="ml-2 align-middle text-base font-medium text-muted-foreground">
                        {gradeDisplay === 'N/A' ? 'Not enough signal yet' : GRADE_LABEL[gradeDisplay]}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {gradeDisplay === 'N/A'
                        ? "This is your first report — there's not enough real signal yet for a fair grade here. It'll sharpen as you add more."
                        : "A stable baseline, plus how this week's effort is going — some of this you control, some you don't."}
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {grade.categories.map((c) => {
                        const categoryDisplay = displayGrade(c.grade, isFirstReport)
                        // Categories are graded A-F on a genuine curve — C is
                        // the expected, honest outcome, not a failure (see
                        // GRADE_BAND_DESCRIPTION). Forcing a ✓/✗ read onto
                        // that would misrepresent a graded scale as binary
                        // pass/fail, so only the 🔒 locked icon applies here
                        // (the real "not enough signal yet" state) — the
                        // letter grade itself, already color-coded, carries
                        // the graded read.
                        return (
                          <div key={c.key} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                            <span className="flex items-center gap-2 text-foreground">
                              {categoryDisplay === 'N/A' && <StatusIcon status="locked" size={14} />}
                              {c.label}
                            </span>
                            <span
                              className={cn(
                                'font-semibold tabular-nums',
                                categoryDisplay === 'N/A' ? 'text-muted-foreground' : GRADE_TEXT_COLOR[categoryDisplay]
                              )}
                            >
                              {categoryDisplay}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {!searchExecutionAvailable ? (
                      <p className="mt-4 text-xs text-muted-foreground">
                        You haven&apos;t started your Search Sprint yet — that&apos;s not a failure,
                        it&apos;s a starting line. Commit to this week&apos;s goals and weekly effort
                        starts factoring into your grade this Sunday.
                      </p>
                    ) : (
                      !grade.categoryMinimumsMet && (
                        <p className="mt-4 text-xs font-medium text-foreground">
                          This week is capped at B — an A now requires real work across Networking,
                          Learning, and Working, not just one.
                        </p>
                      )
                    )}
                  </div>
                )
              })()
            )}
            <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
              Everyone will not make it — but doing the real work meaningfully improves your odds.
              Weekly effort is the lever above that&apos;s entirely in your hands.
            </p>
            <div className="mt-4 rounded-lg border border-brand/20 bg-brand/5 p-4">
              {casuallySearching ? (
                <p className="text-sm font-medium text-foreground">
                  When you&apos;re ready to prioritize this, your{' '}
                  <Link href="/dashboard" className="text-primary underline underline-offset-4">
                    Search Sprint
                  </Link>{' '}
                  will show you exactly what moves your grade toward an A — no clock running in the
                  meantime.
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    This week, a strong week of effort takes about{' '}
                    <span className="font-semibold">{aTargetHours}h</span> of real committed work; a
                    modest week takes about <span className="font-semibold">{bTargetHours}h</span>.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    That target grows a little each week through Week 5, then holds steady — see
                    your{' '}
                    <Link href="/dashboard" className="text-primary underline underline-offset-4">
                      Search Sprint
                    </Link>{' '}
                    for this week&apos;s exact commitment.
                  </p>
                </>
              )}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-white p-4">
              <p className="text-sm font-medium text-foreground">
                {completedReferencesCount >= REFERENCE_CONFIDENCE_TARGET
                  ? `Backed by ${completedReferencesCount} completed references.`
                  : `Reference-backed confidence: ${completedReferencesCount} of ${REFERENCE_CONFIDENCE_TARGET}.`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {completedReferencesCount >= REFERENCE_CONFIDENCE_TARGET
                  ? "Most categories above now read at High confidence because former colleagues and managers have verified your work directly — that's real, external validation, not just self-report."
                  : `Every category above leans more on your own self-report until real references back it up. At ${REFERENCE_CONFIDENCE_TARGET} completed references, your grades carry full outside validation — it's the single biggest lever you have left, and it costs you nothing but an ask.`}
              </p>
              {completedReferencesCount < REFERENCE_CONFIDENCE_TARGET && (
                <Link
                  href="/dashboard/references"
                  className="mt-2 inline-block text-xs text-primary underline underline-offset-4"
                >
                  Request a reference →
                </Link>
              )}
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

          <Suspense fallback={null}>
            <SearchStrategyGuidanceSection candidateId={profile.id} />
          </Suspense>

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

          {/* Your Search Sprint — the same list the Search Sprint page draws from */}
          <div className="mt-10 border-t border-border pt-8 print:hidden">
            <SectionHeading>Your Search Sprint – Week&apos;s Activities</SectionHeading>
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

          <Suspense fallback={null}>
            <WeeklyFocusSection candidateId={profile.id} />
          </Suspense>

          {/* Glossary — moved to the back so the report leads with the
              candidate's own results, not the explainer. */}
          <div className="mt-10 border-t border-border pt-8 print:hidden">
            <SectionHeading>Understanding your grades</SectionHeading>
            <div className="mt-4">
              <GradeSystemExplainer />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
