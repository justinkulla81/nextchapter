import 'server-only'
import { prisma } from '@/lib/prisma'

export type CommunityFeedItemType = 'alist' | 'activity' | 'victoria_insight' | 'comeback'

export interface CommunityFeedItem {
  id: string
  type: CommunityFeedItemType
  displayName: string | null // null for victoria_insight — platform-wide, not tied to a candidate
  avatarUrl: string | null
  detail: string
  occurredAt: Date
}

export function anonymize(firstName: string | null, lastName: string | null): string | null {
  if (!firstName) return null
  return `${firstName} ${lastName ? `${lastName[0]}.` : ''}`.trim()
}

// Respects the candidate's own visibility toggle — same rule as messaging.
function visibleAvatarUrl(candidate: { profilePictureUrl: string | null; profilePictureVisible: boolean }): string | null {
  return candidate.profilePictureVisible ? candidate.profilePictureUrl : null
}

const FEED_WINDOW_DAYS = 14
const COMEBACK_MIN_DAYS_SINCE_JOIN = 21

// Small curated set of platform-pattern tips — not a live content pipeline
// (that's a real future investment, deferred per IDEAS.md). Rotates by day
// so it isn't the same tip every time without needing any real infra.
const VICTORIA_INSIGHTS = [
  'Candidates who log LinkedIn activity at least 3x a week get replies noticeably more often than those who post once and stop.',
  'The strongest cover letters here name one specific thing about the team or the posting — not just the role title.',
  'Most people find their first real conversation somewhere around 15-20 outreach messages in, not the first five.',
]

function getVictoriaInsight(): CommunityFeedItem {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const detail = VICTORIA_INSIGHTS[dayIndex % VICTORIA_INSIGHTS.length]
  return {
    id: `victoria-insight-${dayIndex}`,
    type: 'victoria_insight',
    displayName: null,
    avatarUrl: null,
    detail,
    occurredAt: new Date(),
  }
}

// Real, live-computed anonymized activity — no curated content or
// cross-candidate "insights" beyond the small rotating tip above (a real
// editorial pipeline needs a bigger user base than exists yet). Every other
// item here is a genuine event pulled from existing data, not synthesized.
export async function getCommunityFeed(limit = 20): Promise<CommunityFeedItem[]> {
  const windowStart = new Date(Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const items: CommunityFeedItem[] = [getVictoriaInsight()]

  // Sourced from WeeklyBadgeEarned, the real currently-written record —
  // SundayNightReport.onAList is legacy and nothing writes to it anymore
  // (see src/lib/badges/weekly-badge-archive.ts).
  const aListBadges = await prisma.weeklyBadgeEarned.findMany({
    where: { badgeKey: 'WEEKLY_SCORE_A_LIST', earnedAt: { gte: windowStart } },
    include: { candidate: true },
    orderBy: { earnedAt: 'desc' },
  })
  for (const badge of aListBadges) {
    if (badge.candidate.aListOptOut || badge.candidate.privacyTier === 'LOCKED') continue
    const name = anonymize(badge.candidate.firstName, badge.candidate.lastName)
    if (!name) continue
    items.push({
      id: `alist-${badge.id}`,
      type: 'alist',
      displayName: name,
      avatarUrl: visibleAvatarUrl(badge.candidate),
      detail: 'made this week’s A-List',
      occurredAt: badge.earnedAt,
    })
  }

  const recentReferences = await prisma.reference.findMany({
    where: { status: 'COMPLETED', completedAt: { gte: windowStart } },
    include: { candidate: true },
    orderBy: { completedAt: 'desc' },
  })
  for (const ref of recentReferences) {
    if (!ref.completedAt || ref.candidate.privacyTier === 'LOCKED') continue
    const name = anonymize(ref.candidate.firstName, ref.candidate.lastName)
    if (!name) continue
    items.push({
      id: `ref-${ref.id}`,
      type: 'activity',
      displayName: name,
      avatarUrl: visibleAvatarUrl(ref.candidate),
      detail: 'had a reference come through',
      occurredAt: ref.completedAt,
    })
  }

  const recentWorkSamples = await prisma.workSample.findMany({
    where: { createdAt: { gte: windowStart } },
    include: { candidate: true },
    orderBy: { createdAt: 'desc' },
  })
  for (const sample of recentWorkSamples) {
    if (sample.candidate.privacyTier === 'LOCKED') continue
    const name = anonymize(sample.candidate.firstName, sample.candidate.lastName)
    if (!name) continue
    items.push({
      id: `sample-${sample.id}`,
      type: 'activity',
      displayName: name,
      avatarUrl: visibleAvatarUrl(sample.candidate),
      detail: 'uploaded a work sample',
      occurredAt: sample.createdAt,
    })
  }

  const activeStreaks = await prisma.candidateProfile.findMany({
    where: { currentStreak: { gte: 7 }, privacyTier: { not: 'LOCKED' } },
    orderBy: { currentStreak: 'desc' },
    take: 10,
  })
  for (const candidate of activeStreaks) {
    const name = anonymize(candidate.firstName, candidate.lastName)
    if (!name) continue
    items.push({
      id: `streak-${candidate.id}`,
      type: 'activity',
      displayName: name,
      avatarUrl: visibleAvatarUrl(candidate),
      detail: `is on a ${candidate.currentStreak}-day check-in streak`,
      occurredAt: candidate.lastCheckInAt ?? new Date(),
    })
  }

  const recentInterviews = await prisma.jobPosting.findMany({
    where: { interviewLandedAt: { gte: windowStart } },
    include: { candidate: true },
    orderBy: { interviewLandedAt: 'asc' },
  })
  const seenComebackCandidates = new Set<string>()
  for (const jobPosting of recentInterviews) {
    if (!jobPosting.interviewLandedAt) continue
    if (jobPosting.candidate.privacyTier === 'LOCKED') continue
    if (seenComebackCandidates.has(jobPosting.candidateId)) continue
    seenComebackCandidates.add(jobPosting.candidateId)

    const priorInterviewCount = await prisma.jobPosting.count({
      where: { candidateId: jobPosting.candidateId, interviewLandedAt: { lt: jobPosting.interviewLandedAt } },
    })
    if (priorInterviewCount > 0) continue // not their first interview

    const joinedAt = jobPosting.candidate.registrationCompletedAt ?? jobPosting.candidate.createdAt
    const daysSinceJoin =
      (jobPosting.interviewLandedAt.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceJoin < COMEBACK_MIN_DAYS_SINCE_JOIN) continue // too fast to read as a turnaround

    const name = anonymize(jobPosting.candidate.firstName, jobPosting.candidate.lastName)
    if (!name) continue
    items.push({
      id: `comeback-${jobPosting.id}`,
      type: 'comeback',
      displayName: name,
      avatarUrl: visibleAvatarUrl(jobPosting.candidate),
      detail: 'landed their first interview after a slow start',
      occurredAt: jobPosting.interviewLandedAt,
    })
  }

  return items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit)
}
