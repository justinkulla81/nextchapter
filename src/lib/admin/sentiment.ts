import 'server-only'
import { prisma } from '@/lib/prisma'
import { MOOD_SCORE } from '@/lib/daily/mood-labels'
import { normalizeGradeSnapshot } from '@/lib/scoring/hireability-grade'
import type { Grade } from '@/lib/scoring/grade'

const TRAILING_WINDOW_DAYS = 14

export interface CandidateSentimentRow {
  id: string
  name: string
  email: string
  sentimentScore: number | null // 0-100 average over the trailing window, null if no check-ins at all
  lowSentiment: boolean
  recentGrade: Grade | null
  jobsAppliedCount: number
  networkingCount: number
}

// One pass over every candidate's trailing check-ins, latest report, and
// applied/outreach counts — same "don't over-engineer for volume you don't
// have" call as getCoachCaseload's per-client loop, since this product's
// candidate pool is still small enough that N parallel queries beats
// building a single mega-aggregate query.
export async function getAllCandidateSentiment(): Promise<CandidateSentimentRow[]> {
  const windowStart = new Date()
  windowStart.setUTCDate(windowStart.getUTCDate() - (TRAILING_WINDOW_DAYS - 1))
  windowStart.setUTCHours(0, 0, 0, 0)

  const candidates = await prisma.candidateProfile.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dailyCheckIns: {
        where: { checkedInAt: { gte: windowStart } },
        select: { mood: true },
      },
      hireabilityReports: {
        orderBy: { generatedAt: 'desc' },
        take: 1,
        select: { hireabilityGradeAtGeneration: true },
      },
      jobPostings: { where: { appliedAt: { not: null } }, select: { id: true } },
      outreachLogs: { select: { id: true } },
    },
  })

  const authEmails = await getEmailsFor(candidates.map((c) => c.id))

  return candidates.map((c) => {
    const checkIns = c.dailyCheckIns
    const sentimentScore =
      checkIns.length === 0
        ? null
        : Math.round(checkIns.reduce((sum, ci) => sum + MOOD_SCORE[ci.mood], 0) / checkIns.length)
    const lowSentiment = sentimentScore !== null && sentimentScore < 30
    const grade = normalizeGradeSnapshot(c.hireabilityReports[0]?.hireabilityGradeAtGeneration)

    return {
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed',
      email: authEmails.get(c.id) ?? '—',
      sentimentScore,
      lowSentiment,
      recentGrade: grade?.grade ?? null,
      jobsAppliedCount: c.jobPostings.length,
      networkingCount: c.outreachLogs.length,
    }
  })
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
