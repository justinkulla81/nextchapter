import 'server-only'
import { prisma } from '@/lib/prisma'
import { WEEKLY_BADGE_LABEL, type WeeklyBadgeKey } from '@/lib/badges/weekly-badges'

export interface WeeklyBadgeArchiveCandidate {
  candidateId: string
  name: string
  avatarUrl: string | null
  badgeLabels: string[]
  onAList: boolean
}

export interface WeeklyBadgeArchiveWeek {
  weekStartDate: Date
  candidates: WeeklyBadgeArchiveCandidate[]
}

// Admin's historical view of weekly recognition — sourced from
// WeeklyBadgeEarned, the real, currently-written record (unlike the legacy
// SundayNightReport.onAList field, which nothing writes to anymore).
export async function getWeeklyBadgeArchive(limit = 12): Promise<WeeklyBadgeArchiveWeek[]> {
  const rows = await prisma.weeklyBadgeEarned.findMany({
    orderBy: [{ weekStartDate: 'desc' }, { candidateId: 'asc' }],
    include: {
      candidate: {
        select: { id: true, firstName: true, lastName: true, profilePictureUrl: true, profilePictureVisible: true },
      },
    },
  })

  const weekMap = new Map<number, Map<string, WeeklyBadgeArchiveCandidate>>()

  for (const row of rows) {
    const weekKey = row.weekStartDate.getTime()
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map())
    const candidateMap = weekMap.get(weekKey)!

    if (!candidateMap.has(row.candidateId)) {
      const name = [row.candidate.firstName, row.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed'
      candidateMap.set(row.candidateId, {
        candidateId: row.candidateId,
        name,
        avatarUrl: row.candidate.profilePictureVisible ? row.candidate.profilePictureUrl : null,
        badgeLabels: [],
        onAList: false,
      })
    }

    const entry = candidateMap.get(row.candidateId)!
    const badgeKey = row.badgeKey as WeeklyBadgeKey
    entry.badgeLabels.push(WEEKLY_BADGE_LABEL[badgeKey] ?? row.badgeKey)
    if (badgeKey === 'WEEKLY_SCORE_A_LIST') entry.onAList = true
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => b - a)
    .slice(0, limit)
    .map(([weekKey, candidateMap]) => ({
      weekStartDate: new Date(weekKey),
      candidates: Array.from(candidateMap.values()).sort((a, b) => (b.onAList ? 1 : 0) - (a.onAList ? 1 : 0)),
    }))
}
