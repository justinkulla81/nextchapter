import 'server-only'
import { prisma } from '@/lib/prisma'

// Phase 1 badges reward activity (not identity, per the product spec —
// that's Phase 2 and explicitly out of scope). Computed live from existing
// data rather than persisted, since each is a simple derived fact.
export type BadgeKey =
  | 'FIRST_REFERENCE'
  | 'FIRST_WORK_SAMPLE'
  | 'FIRST_COMMUNITY_POST'
  | 'SEVEN_DAY_STREAK'
  | 'THIRTY_DAY_STREAK'
  | 'MADE_A_LIST'

export const BADGE_LABEL: Record<BadgeKey, string> = {
  FIRST_REFERENCE: 'First Reference',
  FIRST_WORK_SAMPLE: 'First Work Sample',
  FIRST_COMMUNITY_POST: 'First Community Post',
  SEVEN_DAY_STREAK: '7-Day Streak',
  THIRTY_DAY_STREAK: '30-Day Streak',
  MADE_A_LIST: 'Made the A-List',
}

export async function computeEarnedBadges(candidateId: string): Promise<BadgeKey[]> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      references: { where: { status: 'COMPLETED' }, take: 1 },
      workSamples: { take: 1 },
      communityPosts: { take: 1 },
      // Sourced from WeeklyBadgeEarned, the real currently-written record —
      // SundayNightReport.onAList is legacy and nothing writes to it anymore
      // (see src/lib/badges/weekly-badge-archive.ts).
      weeklyBadgesEarned: { where: { badgeKey: 'WEEKLY_SCORE_A_LIST' }, take: 1 },
    },
  })

  const badges: BadgeKey[] = []
  if (candidate.references.length > 0) badges.push('FIRST_REFERENCE')
  if (candidate.workSamples.length > 0) badges.push('FIRST_WORK_SAMPLE')
  if (candidate.communityPosts.length > 0) badges.push('FIRST_COMMUNITY_POST')
  if (candidate.longestStreak >= 7) badges.push('SEVEN_DAY_STREAK')
  if (candidate.longestStreak >= 30) badges.push('THIRTY_DAY_STREAK')
  if (candidate.weeklyBadgesEarned.length > 0) badges.push('MADE_A_LIST')

  return badges
}
