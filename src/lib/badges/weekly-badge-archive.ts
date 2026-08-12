import 'server-only'
import { prisma } from '@/lib/prisma'
import { WEEKLY_BADGE_LABEL, type WeeklyBadgeKey } from '@/lib/badges/weekly-badges'

export interface WeeklyBadgeArchiveCandidate {
  candidateId: string
  name: string
  avatarUrl: string | null
  badgeLabels: string[]
  onSprintTarget: boolean
  weeksInSystem: number | null
  totalSprintTargetWeeks: number
}

export interface WeeklyBadgeArchiveWeek {
  weekStartDate: Date
  candidates: WeeklyBadgeArchiveCandidate[]
}

// Admin's historical view of weekly recognition — sourced from
// WeeklyBadgeEarned, the real, currently-written record (unlike the legacy
// SundayNightReport.onAList field, which nothing writes to anymore).
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

export async function getWeeklyBadgeArchive(limit = 12): Promise<WeeklyBadgeArchiveWeek[]> {
  const [rows, totalSprintTargetByCandidate] = await Promise.all([
    prisma.weeklyBadgeEarned.findMany({
      orderBy: [{ weekStartDate: 'desc' }, { candidateId: 'asc' }],
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
            registrationCompletedAt: true,
            createdAt: true,
          },
        },
      },
    }),
    // All-time Sprint Target count, not scoped to the `limit`-week window
    // shown below — a candidate who's been around longer than the archive
    // displays should still get full credit for every week they earned it.
    prisma.weeklyBadgeEarned.groupBy({
      by: ['candidateId'],
      where: { badgeKey: 'WEEKLY_SPRINT_TARGET_HIT' },
      _count: true,
    }),
  ])

  const totalSprintTargetMap = new Map(totalSprintTargetByCandidate.map((r) => [r.candidateId, r._count]))

  const weekMap = new Map<number, Map<string, WeeklyBadgeArchiveCandidate>>()

  for (const row of rows) {
    const weekKey = row.weekStartDate.getTime()
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map())
    const candidateMap = weekMap.get(weekKey)!

    if (!candidateMap.has(row.candidateId)) {
      const name = [row.candidate.firstName, row.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed'
      const since = row.candidate.registrationCompletedAt ?? row.candidate.createdAt
      const weeksInSystem = since ? Math.floor((Date.now() - since.getTime()) / MS_PER_WEEK) : null
      candidateMap.set(row.candidateId, {
        candidateId: row.candidateId,
        name,
        avatarUrl: row.candidate.profilePictureUrl,
        badgeLabels: [],
        onSprintTarget: false,
        weeksInSystem,
        totalSprintTargetWeeks: totalSprintTargetMap.get(row.candidateId) ?? 0,
      })
    }

    const entry = candidateMap.get(row.candidateId)!
    const badgeKey = row.badgeKey as WeeklyBadgeKey
    entry.badgeLabels.push(WEEKLY_BADGE_LABEL[badgeKey] ?? row.badgeKey)
    if (badgeKey === 'WEEKLY_SPRINT_TARGET_HIT') entry.onSprintTarget = true
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => b - a)
    .slice(0, limit)
    .map(([weekKey, candidateMap]) => ({
      weekStartDate: new Date(weekKey),
      candidates: Array.from(candidateMap.values()).sort(
        (a, b) => (b.onSprintTarget ? 1 : 0) - (a.onSprintTarget ? 1 : 0)
      ),
    }))
}
