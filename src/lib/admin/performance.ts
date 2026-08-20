import 'server-only'
import { prisma } from '@/lib/prisma'
import { EXCLUDE_SYSTEM_ACCOUNT } from '@/lib/admin/system-account-filter'
import { MOOD_SCORE } from '@/lib/daily/mood-labels'
import type { Grade } from '@/lib/scoring/grade'
import { getAuthEmail, type AuthUserSummary } from '@/lib/admin/auth-users'

const TRAILING_WINDOW_DAYS = 14

export type PerformanceStatus = 'green' | 'yellow' | 'red'

// Worst-to-best for sorting — a candidate needing attention should sort
// first when the admin flips to ascending.
export const PERFORMANCE_STATUS_RANK: Record<PerformanceStatus, number> = { red: 0, yellow: 1, green: 2 }

export interface CandidatePerformanceRow {
  id: string
  name: string
  email: string
  sentimentScore: number | null // 0-100 average over the trailing window, null if no check-ins at all
  lowSentiment: boolean
  recentGrade: Grade | null
  jobsAppliedCount: number
  networkingCount: number
  actionsDoneCount: number // all-time completed Search Sprint actions
  gmailConnected: boolean
  daysSinceRegistration: number | null
  totalCheckIns: number
  checkInsPastWeek: number
  status: PerformanceStatus
}

interface CommittedActionLike {
  completed: boolean
}

// A simple, transparent read of "how is this candidate doing" — not a
// scoring model, just a five-signal traffic light: a live sentiment alert
// always forces red (it's the most urgent signal); otherwise it's how many
// of the four engagement signals (actions done, jobs applied, networking,
// Gmail connected) are true.
function computeStatus(params: {
  lowSentiment: boolean
  actionsDoneCount: number
  jobsAppliedCount: number
  networkingCount: number
  gmailConnected: boolean
}): PerformanceStatus {
  if (params.lowSentiment) return 'red'
  const positiveSignals = [
    params.actionsDoneCount > 0,
    params.jobsAppliedCount > 0,
    params.networkingCount > 0,
    params.gmailConnected,
  ].filter(Boolean).length
  if (positiveSignals >= 3) return 'green'
  if (positiveSignals >= 1) return 'yellow'
  return 'red'
}

const CANDIDATE_PERFORMANCE_SELECT = {
  id: true,
  userId: true,
  firstName: true,
  lastName: true,
  createdAt: true,
  registrationCompletedAt: true,
  dailyCheckIns: {
    select: { mood: true, checkedInAt: true },
  },
  // MarketRealitySnapshot (weekly, guaranteed cadence) rather than
  // MarketRealityReport — a report only generates on specific triggers.
  marketRealitySnapshots: {
    orderBy: { weekStartDate: 'desc' },
    take: 1,
    select: { grade: true },
  },
  jobPostings: { where: { appliedAt: { not: null } }, select: { id: true } },
  outreachLogs: { select: { id: true } },
  weeklySprints: { select: { committedActions: true } },
  emailConnection: { select: { disconnectedAt: true } },
} as const

type CandidateForPerformance = {
  id: string
  userId: string
  firstName: string | null
  lastName: string | null
  createdAt: Date
  registrationCompletedAt: Date | null
  dailyCheckIns: { mood: string; checkedInAt: Date }[]
  marketRealitySnapshots: { grade: string }[]
  jobPostings: { id: string }[]
  outreachLogs: { id: string }[]
  weeklySprints: { committedActions: unknown }[]
  emailConnection: { disconnectedAt: Date | null } | null
}

function buildPerformanceRow(c: CandidateForPerformance, email: string, now: Date): CandidatePerformanceRow {
  const windowStart = new Date(now)
  windowStart.setUTCDate(windowStart.getUTCDate() - (TRAILING_WINDOW_DAYS - 1))
  windowStart.setUTCHours(0, 0, 0, 0)
  const pastWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const checkInsInWindow = c.dailyCheckIns.filter((ci) => ci.checkedInAt >= windowStart)
  const sentimentScore =
    checkInsInWindow.length === 0
      ? null
      : Math.round(
          checkInsInWindow.reduce((sum, ci) => sum + MOOD_SCORE[ci.mood as keyof typeof MOOD_SCORE], 0) /
            checkInsInWindow.length
        )
  const lowSentiment = sentimentScore !== null && sentimentScore < 30
  const recentGrade = (c.marketRealitySnapshots[0]?.grade as Grade | undefined) ?? null

  const jobsAppliedCount = c.jobPostings.length
  const networkingCount = c.outreachLogs.length
  const actionsDoneCount = c.weeklySprints.reduce((sum, s) => {
    const actions = (s.committedActions as unknown as CommittedActionLike[]) ?? []
    return sum + actions.filter((a) => a.completed).length
  }, 0)
  const gmailConnected = !!c.emailConnection && !c.emailConnection.disconnectedAt

  const registeredAt = c.registrationCompletedAt ?? c.createdAt
  const daysSinceRegistration = registeredAt
    ? Math.max(0, Math.floor((now.getTime() - registeredAt.getTime()) / 86_400_000))
    : null

  return {
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed',
    email,
    sentimentScore,
    lowSentiment,
    recentGrade,
    jobsAppliedCount,
    networkingCount,
    actionsDoneCount,
    gmailConnected,
    daysSinceRegistration,
    totalCheckIns: c.dailyCheckIns.length,
    checkInsPastWeek: c.dailyCheckIns.filter((ci) => ci.checkedInAt >= pastWeekStart).length,
    status: computeStatus({ lowSentiment, actionsDoneCount, jobsAppliedCount, networkingCount, gmailConnected }),
  }
}

// One pass over every candidate's trailing check-ins, latest report, and
// applied/outreach/action counts — same "don't over-engineer for volume you
// don't have" call as getCoachCaseload's per-client loop, since this
// product's candidate pool is still small enough that N parallel queries
// beats building a single mega-aggregate query.
export async function getAllCandidatePerformance(): Promise<CandidatePerformanceRow[]> {
  const now = new Date()
  const candidates = await prisma.candidateProfile.findMany({
    where: EXCLUDE_SYSTEM_ACCOUNT,
    select: CANDIDATE_PERFORMANCE_SELECT,
  })
  const authEmails = await getEmailsFor(candidates.map((c) => c.id))
  return candidates.map((c) => buildPerformanceRow(c, authEmails.get(c.id) ?? '—', now))
}

// Single-candidate variant for the admin candidate detail page's stats row —
// same computation, reusing the authUsers map that page already loads
// rather than re-fetching every auth user just for one email.
export async function getCandidatePerformance(
  candidateId: string,
  authUsers: Map<string, AuthUserSummary>
): Promise<CandidatePerformanceRow | null> {
  const c = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: CANDIDATE_PERFORMANCE_SELECT,
  })
  if (!c) return null
  return buildPerformanceRow(c, getAuthEmail(authUsers, c.userId), new Date())
}

async function getEmailsFor(candidateIds: string[]): Promise<Map<string, string>> {
  const { listAllAuthUsers, getAuthEmail } = await import('@/lib/admin/auth-users')
  const authUsers = await listAllAuthUsers()
  const rows = await prisma.candidateProfile.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, userId: true },
  })
  return new Map(rows.map((r) => [r.id, getAuthEmail(authUsers, r.userId)]))
}
