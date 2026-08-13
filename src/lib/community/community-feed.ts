import 'server-only'
import { prisma } from '@/lib/prisma'

export type CommunityFeedItemType = 'activity' | 'victoria_insight' | 'comeback' | 'marketBrief'

export interface CommunityFeedItem {
  id: string
  type: CommunityFeedItemType
  displayName: string | null // null for victoria_insight/marketBrief — not tied to a candidate
  avatarUrl: string | null
  detail: string
  occurredAt: Date
  // Only set for marketBrief items — links out to the source article.
  url?: string | null
}

export function anonymize(firstName: string | null, lastName: string | null): string | null {
  if (!firstName) return null
  return `${firstName} ${lastName ? `${lastName[0]}.` : ''}`.trim()
}

function visibleAvatarUrl(candidate: { profilePictureUrl: string | null }): string | null {
  return candidate.profilePictureUrl
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

  // Sprint Target hits used to be synthesized here straight off
  // WeeklyBadgeEarned. Now maybeCreateMilestonePost (src/lib/community/milestone-posts.ts)
  // writes a real CommunityPost when the badge is earned, so it flows
  // through as a normal reactable/removable post instead of a synthetic
  // feed item — see computeWeeklyBadges' call site.

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
  // The earliest-in-window posting per candidate (ascending sort + first-seen
  // wins) — a candidate for a "comeback" nomination if that posting also
  // turns out to be their first interview ever, checked in bulk below.
  const seenComebackCandidates = new Set<string>()
  const firstInWindowByCandidate = new Map<string, (typeof recentInterviews)[number]>()
  for (const jobPosting of recentInterviews) {
    if (!jobPosting.interviewLandedAt) continue
    if (jobPosting.candidate.privacyTier === 'LOCKED') continue
    if (seenComebackCandidates.has(jobPosting.candidateId)) continue
    seenComebackCandidates.add(jobPosting.candidateId)
    firstInWindowByCandidate.set(jobPosting.candidateId, jobPosting)
  }

  // One grouped query instead of one `count` per candidate — the group's
  // minimum interviewLandedAt across ALL of a candidate's postings (not just
  // ones in this window) tells us whether their earliest-in-window posting
  // really is their first interview ever, or just their first in the last
  // 14 days.
  const candidateIds = [...firstInWindowByCandidate.keys()]
  const earliestEverByCandidate =
    candidateIds.length > 0
      ? await prisma.jobPosting.groupBy({
          by: ['candidateId'],
          where: { candidateId: { in: candidateIds }, interviewLandedAt: { not: null } },
          _min: { interviewLandedAt: true },
        })
      : []
  const earliestEverMap = new Map(earliestEverByCandidate.map((e) => [e.candidateId, e._min.interviewLandedAt]))

  for (const [candidateId, jobPosting] of firstInWindowByCandidate) {
    const earliestEver = earliestEverMap.get(candidateId)
    if (!earliestEver || earliestEver.getTime() !== jobPosting.interviewLandedAt!.getTime()) continue // not their first interview

    const joinedAt = jobPosting.candidate.registrationCompletedAt ?? jobPosting.candidate.createdAt
    const daysSinceJoin =
      (jobPosting.interviewLandedAt!.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceJoin < COMEBACK_MIN_DAYS_SINCE_JOIN) continue // too fast to read as a turnaround

    const name = anonymize(jobPosting.candidate.firstName, jobPosting.candidate.lastName)
    if (!name) continue
    items.push({
      id: `comeback-${jobPosting.id}`,
      type: 'comeback',
      displayName: name,
      avatarUrl: visibleAvatarUrl(jobPosting.candidate),
      detail: 'landed their first interview after a slow start',
      occurredAt: jobPosting.interviewLandedAt!,
    })
  }

  return items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit)
}

// Admin-only — mirrors getReportedThreads' scoping in peer-threads.ts:
// reported posts only, never a general feed-browsing surface for admin.
export async function getReportedCommunityPosts() {
  const posts = await prisma.communityPost.findMany({
    where: { reportedAt: { not: null } },
    orderBy: { reportedAt: 'desc' },
    include: { candidate: { select: { firstName: true, lastName: true } } },
  })
  return posts.map((post) => ({
    id: post.id,
    postType: post.postType,
    description: post.description,
    authorName: anonymize(post.candidate.firstName, post.candidate.lastName) ?? 'Candidate',
    reportedAt: post.reportedAt,
    reportedByCandidateId: post.reportedByCandidateId,
    reportReason: post.reportReason,
  }))
}
