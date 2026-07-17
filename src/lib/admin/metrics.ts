// Pre-seed investor metrics — computed live from real candidate data, never
// from a separate snapshot table. "Trend vs last week" is derived by running
// the exact same computation twice, once as of now and once as of 7 days
// ago (excluding any row timestamped after that cutoff), rather than storing
// a rolling history table.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { scoreToGrade, GRADE_LABEL, type Grade, type HireabilityGrade } from '@/lib/scoring/grade'
import type { CommittedAction } from '@/lib/weekly/sprint'
import type { GapDurationBucket, MarketResponseType } from '@prisma/client'

export type MetricFormat = 'percent' | 'count' | 'days' | 'grade'
export type MetricStatus = 'meeting' | 'below' | 'far_below' | 'no_target' | 'not_tracked' | 'no_data'

export interface MetricRow {
  key: string
  label: string
  value: number | string | null
  target: number | string | null
  format: MetricFormat
  trend: 'up' | 'down' | 'flat' | 'unknown'
  status: MetricStatus
}

export interface PreSeedMetrics {
  funnel: MetricRow[]
  quality: MetricRow[]
  marketResponse: MetricRow[]
  health: MetricRow[]
  victoriaPerformance: MetricRow[]
  demandTesting: MetricRow[]
  candidatesAtWeek4Plus: number
  proofPoint: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const HARD_ACTION_POINTS_FLOOR = 20 // STANDARD_EFFORT.points — a real, non-trivial committed action

interface CandidateSnapshot {
  id: string
  createdAt: Date
  registrationCompletedAt: Date | null
  gapDuration: GapDurationBucket | null
  checkIns: Date[]
  sprints: { createdAt: Date; committedActions: CommittedAction[] }[]
  reports: { generatedAt: Date; weekStartDate: Date; onAList: boolean; gradeSnapshot: HireabilityGrade }[]
  marketResponseLogs: { type: MarketResponseType; loggedAt: Date }[]
  outreachLogs: Date[]
  interviewDates: Date[]
  offerDates: Date[]
}

type CandidateRow = Awaited<ReturnType<typeof loadAllCandidateRows>>[number]

// Single unfiltered fetch — "as of last week" is always a strict subset of
// "as of now" (any row timestamped before last week is also before now), so
// fetching once and deriving both snapshots in memory avoids running this
// full nested-relation query against the database twice per page load.
async function loadAllCandidateRows() {
  return prisma.candidateProfile.findMany({
    select: {
      id: true,
      createdAt: true,
      registrationCompletedAt: true,
      gapDuration: true,
      dailyCheckIns: { select: { checkedInAt: true } },
      weeklySprints: { select: { createdAt: true, committedActions: true } },
      sundayNightReports: {
        select: { generatedAt: true, weekStartDate: true, onAList: true, gradeSnapshot: true },
      },
      marketResponseLogs: { select: { type: true, loggedAt: true } },
      outreachLogs: { select: { loggedAt: true } },
      jobPostings: { select: { interviewLandedAt: true, offerReceivedAt: true } },
    },
  })
}

// Pure, synchronous — applies the same "as of" cutoff filtering previously
// done via Prisma `where` clauses, just against already-fetched rows.
function snapshotAsOf(rows: CandidateRow[], asOf: Date): CandidateSnapshot[] {
  return rows
    .filter((r) => r.createdAt <= asOf)
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      registrationCompletedAt:
        r.registrationCompletedAt && r.registrationCompletedAt <= asOf ? r.registrationCompletedAt : null,
      gapDuration: r.gapDuration,
      checkIns: r.dailyCheckIns.map((c) => c.checkedInAt).filter((d) => d <= asOf),
      sprints: r.weeklySprints
        .filter((s) => s.createdAt <= asOf)
        .map((s) => ({
          createdAt: s.createdAt,
          committedActions: s.committedActions as unknown as CommittedAction[],
        })),
      reports: r.sundayNightReports
        .filter((rep) => rep.generatedAt <= asOf)
        .map((rep) => ({
          generatedAt: rep.generatedAt,
          weekStartDate: rep.weekStartDate,
          onAList: rep.onAList,
          gradeSnapshot: rep.gradeSnapshot as unknown as HireabilityGrade,
        })),
      marketResponseLogs: r.marketResponseLogs.filter((l) => l.loggedAt <= asOf),
      outreachLogs: r.outreachLogs.map((o) => o.loggedAt).filter((d) => d <= asOf),
      interviewDates: r.jobPostings
        .map((j) => j.interviewLandedAt)
        .filter((d): d is Date => d !== null && d <= asOf),
      offerDates: r.jobPostings.map((j) => j.offerReceivedAt).filter((d): d is Date => d !== null && d <= asOf),
    }))
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / DAY_MS
}

function firstExternalSignalDate(c: CandidateSnapshot): Date | null {
  const dates = [
    ...c.marketResponseLogs.map((l) => l.loggedAt),
    ...c.interviewDates,
    ...c.offerDates,
  ]
  if (dates.length === 0) return null
  return new Date(Math.min(...dates.map((d) => d.getTime())))
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

interface RawAggregates {
  totalStarted: number
  totalSignups: number
  onboardingCompletionRate: number | null
  firstSessionActionRate: number | null
  week2RetentionRate: number | null
  week6RetentionRate: number | null
  week13CompletionRate: number | null
  hardActionInFirst2WeeksRate: number | null
  externalSignalByWeek4Rate: number | null
  medianTimeToFirstExternalSignal: number | null
  avgOutreachToReplyRate: number | null
  avgConversationsPerActiveUser: number | null
  totalInterviewsLogged: number
  weeklyAListEarners: number
  avgSearchExecutionGrade: Grade | null
  avgMarketPositionGrade: Grade | null
  candidatesAtWeek4Plus: number
}

function computeRawAggregates(candidates: CandidateSnapshot[], asOf: Date): RawAggregates {
  const totalStarted = candidates.length
  const signups = candidates.filter((c) => c.registrationCompletedAt !== null)
  const totalSignups = signups.length
  const onboardingCompletionRate = pct(totalSignups, totalStarted)

  const firstSessionActive = signups.filter((c) => {
    const reg = c.registrationCompletedAt!
    const windowEnd = new Date(reg.getTime() + DAY_MS)
    return (
      c.checkIns.some((d) => d >= reg && d <= windowEnd) ||
      c.sprints.some((s) => s.createdAt >= reg && s.createdAt <= windowEnd)
    )
  })
  const firstSessionActionRate = pct(firstSessionActive.length, totalSignups)

  function retentionRate(weekOffsetDays: number, windowDays: number): number | null {
    const eligible = signups.filter(
      (c) => daysBetween(c.registrationCompletedAt!, asOf) >= weekOffsetDays + windowDays
    )
    if (eligible.length === 0) return null
    const active = eligible.filter((c) => {
      const reg = c.registrationCompletedAt!
      const windowStart = new Date(reg.getTime() + weekOffsetDays * DAY_MS)
      const windowEnd = new Date(reg.getTime() + (weekOffsetDays + windowDays) * DAY_MS)
      return (
        c.checkIns.some((d) => d >= windowStart && d <= windowEnd) ||
        c.sprints.some((s) => s.createdAt >= windowStart && s.createdAt <= windowEnd) ||
        c.reports.some((r) => r.generatedAt >= windowStart && r.generatedAt <= windowEnd)
      )
    })
    return pct(active.length, eligible.length)
  }
  const week2RetentionRate = retentionRate(7, 7)
  const week6RetentionRate = retentionRate(35, 7)

  const week13Eligible = signups.filter((c) => daysBetween(c.registrationCompletedAt!, asOf) >= 13 * 7)
  const week13Reached = week13Eligible.filter((c) => c.reports.length >= 13)
  const week13CompletionRate = pct(week13Reached.length, week13Eligible.length)

  const hardActionEligible = signups.filter((c) => daysBetween(c.registrationCompletedAt!, asOf) >= 14)
  const hardActionActive = hardActionEligible.filter((c) => {
    const reg = c.registrationCompletedAt!
    const cutoff = new Date(reg.getTime() + 14 * DAY_MS)
    return c.sprints.some(
      (s) =>
        s.createdAt <= cutoff &&
        s.committedActions.some((a) => a.completed && a.points >= HARD_ACTION_POINTS_FLOOR)
    )
  })
  const hardActionInFirst2WeeksRate = pct(hardActionActive.length, hardActionEligible.length)

  const week4Eligible = signups.filter((c) => daysBetween(c.registrationCompletedAt!, asOf) >= 28)
  const week4Active = week4Eligible.filter((c) => {
    const reg = c.registrationCompletedAt!
    const cutoff = new Date(reg.getTime() + 28 * DAY_MS)
    const signal = firstExternalSignalDate(c)
    return signal !== null && signal <= cutoff
  })
  const externalSignalByWeek4Rate = pct(week4Active.length, week4Eligible.length)

  const timesToSignal = signups
    .map((c) => {
      const signal = firstExternalSignalDate(c)
      return signal ? daysBetween(c.registrationCompletedAt!, signal) : null
    })
    .filter((d): d is number => d !== null)
  const medianTimeToFirstExternalSignal = median(timesToSignal.map((d) => Math.round(d)))

  const totalReplies = candidates.reduce(
    (sum, c) => sum + c.marketResponseLogs.filter((l) => l.type === 'REPLY').length,
    0
  )
  const totalOutreach = candidates.reduce((sum, c) => sum + c.outreachLogs.length, 0)
  const avgOutreachToReplyRate = pct(totalReplies, totalOutreach)

  const activeUsers = candidates.filter((c) => c.sprints.length > 0)
  const totalConversations = candidates.reduce(
    (sum, c) => sum + c.marketResponseLogs.filter((l) => l.type === 'CONVERSATION').length,
    0
  )
  const avgConversationsPerActiveUser =
    activeUsers.length > 0 ? Math.round((totalConversations / activeUsers.length) * 10) / 10 : null

  const totalInterviewsLogged = candidates.reduce((sum, c) => sum + c.interviewDates.length, 0)

  const latestWeekStart = candidates
    .flatMap((c) => c.reports.map((r) => r.weekStartDate.getTime()))
    .reduce((max, t) => Math.max(max, t), 0)
  const weeklyAListEarners =
    latestWeekStart > 0
      ? candidates.filter((c) =>
          c.reports.some((r) => r.weekStartDate.getTime() === latestWeekStart && r.onAList)
        ).length
      : 0

  const latestSnapshots = candidates
    .map((c) => (c.reports.length > 0 ? c.reports[c.reports.length - 1] : null))
    .filter((r): r is NonNullable<typeof r> => r !== null)
  const avgSearchExecScore = latestSnapshots.length
    ? latestSnapshots.reduce((sum, r) => sum + r.gradeSnapshot.searchExecution.score, 0) / latestSnapshots.length
    : null
  const avgMarketRealityScore = latestSnapshots.length
    ? latestSnapshots.reduce((sum, r) => sum + r.gradeSnapshot.marketReality.score, 0) / latestSnapshots.length
    : null

  const candidatesAtWeek4Plus = signups.filter(
    (c) => daysBetween(c.registrationCompletedAt!, asOf) >= 28
  ).length

  return {
    totalStarted,
    totalSignups,
    onboardingCompletionRate,
    firstSessionActionRate,
    week2RetentionRate,
    week6RetentionRate,
    week13CompletionRate,
    hardActionInFirst2WeeksRate,
    externalSignalByWeek4Rate,
    medianTimeToFirstExternalSignal,
    avgOutreachToReplyRate,
    avgConversationsPerActiveUser,
    totalInterviewsLogged,
    weeklyAListEarners,
    avgSearchExecutionGrade: avgSearchExecScore !== null ? scoreToGrade(avgSearchExecScore) : null,
    avgMarketPositionGrade: avgMarketRealityScore !== null ? scoreToGrade(avgMarketRealityScore) : null,
    candidatesAtWeek4Plus,
  }
}

function trendOf(current: number | null, previous: number | null): MetricRow['trend'] {
  if (current === null || previous === null) return 'unknown'
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'flat'
}

// Distinguishes a metric with no eligible cohort yet (real, just too early
// to have data — e.g. no one has been registered 14 days yet) from a metric
// that isn't instrumented at all (email opens, demand testing).
function noTargetStatus(value: number | null): MetricStatus {
  return value === null ? 'no_data' : 'no_target'
}

function statusOf(value: number | null, target: number | null, higherIsBetter = true): MetricStatus {
  if (target === null) return 'no_target'
  if (value === null) return 'no_data'
  const ratio = higherIsBetter ? value / target : target / value
  if (ratio >= 1) return 'meeting'
  if (ratio >= 0.7) return 'below'
  return 'far_below'
}

function row(
  key: string,
  label: string,
  value: number | string | null,
  target: number | string | null,
  format: MetricFormat,
  trend: MetricRow['trend'],
  status: MetricStatus
): MetricRow {
  return { key, label, value, target, format, trend, status }
}

export async function computePreSeedMetrics(): Promise<PreSeedMetrics> {
  const now = new Date()
  const lastWeek = new Date(now.getTime() - 7 * DAY_MS)

  const allRows = await loadAllCandidateRows()
  const currentSnapshots = snapshotAsOf(allRows, now)
  const lastWeekSnapshots = snapshotAsOf(allRows, lastWeek)
  const cur = computeRawAggregates(currentSnapshots, now)
  const prev = computeRawAggregates(lastWeekSnapshots, lastWeek)

  const funnel: MetricRow[] = [
    row(
      'totalSignups',
      'Total signups',
      cur.totalSignups,
      null,
      'count',
      trendOf(cur.totalSignups, prev.totalSignups),
      'no_target'
    ),
    row(
      'onboardingCompletionRate',
      'Onboarding completion rate',
      cur.onboardingCompletionRate,
      60,
      'percent',
      trendOf(cur.onboardingCompletionRate, prev.onboardingCompletionRate),
      statusOf(cur.onboardingCompletionRate, 60)
    ),
    row(
      'firstSessionActionRate',
      'First-session action rate',
      cur.firstSessionActionRate,
      50,
      'percent',
      trendOf(cur.firstSessionActionRate, prev.firstSessionActionRate),
      statusOf(cur.firstSessionActionRate, 50)
    ),
    row(
      'week2RetentionRate',
      'Week 2 retention',
      cur.week2RetentionRate,
      50,
      'percent',
      trendOf(cur.week2RetentionRate, prev.week2RetentionRate),
      statusOf(cur.week2RetentionRate, 50)
    ),
    row(
      'week6RetentionRate',
      'Week 6 retention',
      cur.week6RetentionRate,
      30,
      'percent',
      trendOf(cur.week6RetentionRate, prev.week6RetentionRate),
      statusOf(cur.week6RetentionRate, 30)
    ),
    row(
      'week13CompletionRate',
      'Week 13 completion',
      cur.week13CompletionRate,
      15,
      'percent',
      trendOf(cur.week13CompletionRate, prev.week13CompletionRate),
      statusOf(cur.week13CompletionRate, 15)
    ),
  ]

  const quality: MetricRow[] = [
    row(
      'hardActionInFirst2WeeksRate',
      'Hard action in first 2 weeks',
      cur.hardActionInFirst2WeeksRate,
      40,
      'percent',
      trendOf(cur.hardActionInFirst2WeeksRate, prev.hardActionInFirst2WeeksRate),
      statusOf(cur.hardActionInFirst2WeeksRate, 40)
    ),
    row(
      'externalSignalByWeek4Rate',
      'External signal by Week 4',
      cur.externalSignalByWeek4Rate,
      30,
      'percent',
      trendOf(cur.externalSignalByWeek4Rate, prev.externalSignalByWeek4Rate),
      statusOf(cur.externalSignalByWeek4Rate, 30)
    ),
    row(
      'medianTimeToFirstExternalSignal',
      'Median time to first external signal',
      cur.medianTimeToFirstExternalSignal,
      null,
      'days',
      trendOf(
        cur.medianTimeToFirstExternalSignal !== null ? -cur.medianTimeToFirstExternalSignal : null,
        prev.medianTimeToFirstExternalSignal !== null ? -prev.medianTimeToFirstExternalSignal : null
      ),
      noTargetStatus(cur.medianTimeToFirstExternalSignal)
    ),
  ]

  const marketResponse: MetricRow[] = [
    row(
      'avgOutreachToReplyRate',
      'Outreach-to-reply rate',
      cur.avgOutreachToReplyRate,
      null,
      'percent',
      trendOf(cur.avgOutreachToReplyRate, prev.avgOutreachToReplyRate),
      noTargetStatus(cur.avgOutreachToReplyRate)
    ),
    row(
      'avgConversationsPerActiveUser',
      'Conversations per active user',
      cur.avgConversationsPerActiveUser,
      null,
      'count',
      trendOf(cur.avgConversationsPerActiveUser, prev.avgConversationsPerActiveUser),
      noTargetStatus(cur.avgConversationsPerActiveUser)
    ),
    row(
      'totalInterviewsLogged',
      'Total interviews logged',
      cur.totalInterviewsLogged,
      null,
      'count',
      trendOf(cur.totalInterviewsLogged, prev.totalInterviewsLogged),
      'no_target'
    ),
  ]

  const health: MetricRow[] = [
    row(
      'weeklyAListEarners',
      "This week's A-List earners",
      cur.weeklyAListEarners,
      null,
      'count',
      trendOf(cur.weeklyAListEarners, prev.weeklyAListEarners),
      'no_target'
    ),
    row(
      'avgSearchExecutionGrade',
      'Average Search Action Grade',
      cur.avgSearchExecutionGrade ? `${cur.avgSearchExecutionGrade} (${GRADE_LABEL[cur.avgSearchExecutionGrade]})` : null,
      null,
      'grade',
      'unknown',
      noTargetStatus(cur.avgSearchExecutionGrade ? 1 : null)
    ),
    row(
      'avgMarketPositionGrade',
      'Average Market Reality Grade',
      cur.avgMarketPositionGrade ? `${cur.avgMarketPositionGrade} (${GRADE_LABEL[cur.avgMarketPositionGrade]})` : null,
      null,
      'grade',
      'unknown',
      noTargetStatus(cur.avgMarketPositionGrade ? 1 : null)
    ),
  ]

  // Not yet instrumented — showing these honestly as untracked rather than
  // fabricating numbers. Email opens need Resend webhook wiring; demand
  // testing needs an actual survey surface. Both are real follow-up work,
  // not something to fake for an investor-facing dashboard.
  const victoriaPerformance: MetricRow[] = [
    row('dailyEmailOpenRate', 'Daily email open rate', null, 55, 'percent', 'unknown', 'not_tracked'),
    row('sundayReportOpenRate', 'Sunday report open rate', null, 55, 'percent', 'unknown', 'not_tracked'),
    row('actionClickThroughRate', 'Action click-through rate', null, null, 'percent', 'unknown', 'not_tracked'),
  ]

  const demandTesting: MetricRow[] = [
    row('coachingInterest', 'Coaching demand-test interest', null, null, 'percent', 'unknown', 'not_tracked'),
    row('recruiterInterest', 'Recruiter demand-test interest', null, null, 'percent', 'unknown', 'not_tracked'),
  ]

  const proofPoint = buildProofPoint(currentSnapshots, cur)

  return {
    funnel,
    quality,
    marketResponse,
    health,
    victoriaPerformance,
    demandTesting,
    candidatesAtWeek4Plus: cur.candidatesAtWeek4Plus,
    proofPoint,
  }
}

const GAP_DURATION_LABEL: Record<GapDurationBucket, string> = {
  ZERO_TO_THREE_MONTHS: 'a few months',
  THREE_TO_SIX_MONTHS: '3-6 months',
  SIX_TO_TWELVE_MONTHS: '6-12 months',
  TWELVE_PLUS_MONTHS: 'over a year',
}

function buildProofPoint(candidates: CandidateSnapshot[], agg: RawAggregates): string | null {
  const PROOF_POINT_THRESHOLD = 50
  if (agg.candidatesAtWeek4Plus < PROOF_POINT_THRESHOLD) return null

  const now = new Date()
  const cohort = candidates.filter(
    (c) => c.registrationCompletedAt !== null && daysBetween(c.registrationCompletedAt, now) >= 28
  )

  const gapCounts = new Map<GapDurationBucket, number>()
  for (const c of cohort) {
    if (!c.gapDuration) continue
    gapCounts.set(c.gapDuration, (gapCounts.get(c.gapDuration) ?? 0) + 1)
  }
  let modalGap: GapDurationBucket | null = null
  let modalCount = 0
  for (const [bucket, count] of gapCounts) {
    if (count > modalCount) {
      modalGap = bucket
      modalCount = count
    }
  }

  const fiveRelationshipActionsRate = pct(
    cohort.filter((c) => {
      const reg = c.registrationCompletedAt!
      const cutoff = new Date(reg.getTime() + 28 * DAY_MS)
      const relationshipActions = c.outreachLogs.filter((d) => d <= cutoff).length
      return relationshipActions >= 5
    }).length,
    cohort.length
  )
  const newConversationRate = pct(
    cohort.filter((c) => {
      const reg = c.registrationCompletedAt!
      const cutoff = new Date(reg.getTime() + 28 * DAY_MS)
      return c.marketResponseLogs.some((l) => l.type === 'CONVERSATION' && l.loggedAt <= cutoff)
    }).length,
    cohort.length
  )
  const interviewOrLeadRate = pct(
    cohort.filter((c) => {
      const reg = c.registrationCompletedAt!
      const cutoff = new Date(reg.getTime() + 28 * DAY_MS)
      const hasInterview = c.interviewDates.some((d) => d <= cutoff)
      const hasPaidLead = c.marketResponseLogs.some(
        (l) => l.type === 'PAID_PROJECT_LEAD' && l.loggedAt <= cutoff
      )
      return hasInterview || hasPaidLead
    }).length,
    cohort.length
  )

  const openingLine = modalGap
    ? `Before NextChapter, these ${cohort.length} members had most commonly been searching for ${GAP_DURATION_LABEL[modalGap]}.`
    : `Before NextChapter, these ${cohort.length} members had been searching with no dedicated system.`

  return [
    openingLine,
    'During their first 4 weeks:',
    `- ${fiveRelationshipActionsRate ?? 0}% completed at least 5 relationship actions`,
    `- ${newConversationRate ?? 0}% generated a new professional conversation`,
    `- ${interviewOrLeadRate ?? 0}% generated an interview or paid project lead`,
  ].join('\n')
}
