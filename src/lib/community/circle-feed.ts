import 'server-only'
import { prisma } from '@/lib/prisma'

export interface CircleFeedItem {
  id: string
  displayName: string // "First L."
  detail: string
  occurredAt: Date
}

function anonymize(firstName: string | null, lastName: string | null): string | null {
  if (!firstName) return null
  return `${firstName} ${lastName ? `${lastName[0]}.` : ''}`.trim()
}

const FEED_WINDOW_DAYS = 14

// Real, live-computed anonymized activity — no curated content or
// cross-candidate "insights" (both need an editorial pipeline and a real
// user base neither of which exist yet). Every item here is a genuine
// event pulled from existing data, not synthesized.
export async function getCircleFeed(limit = 20): Promise<CircleFeedItem[]> {
  const windowStart = new Date(Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const items: CircleFeedItem[] = []

  const aListReports = await prisma.sundayNightReport.findMany({
    where: { onAList: true, generatedAt: { gte: windowStart } },
    include: { candidate: true },
    orderBy: { generatedAt: 'desc' },
  })
  for (const report of aListReports) {
    if (report.candidate.aListOptOut || report.candidate.privacyTier === 'LOCKED') continue
    const name = anonymize(report.candidate.firstName, report.candidate.lastName)
    if (!name) continue
    items.push({
      id: `alist-${report.id}`,
      displayName: name,
      detail: 'made this week’s A-List',
      occurredAt: report.generatedAt,
    })
  }

  const recentPosts = await prisma.communityPost.findMany({
    where: { isActive: true, createdAt: { gte: windowStart } },
    include: { candidate: true },
    orderBy: { createdAt: 'desc' },
  })
  for (const post of recentPosts) {
    if (post.candidate.privacyTier === 'LOCKED') continue
    const name = anonymize(post.candidate.firstName, post.candidate.lastName)
    if (!name) continue
    items.push({
      id: `post-${post.id}`,
      displayName: name,
      detail: `posted on the Community Board${post.postFunction ? ` in ${post.postFunction}` : ''}`,
      occurredAt: post.createdAt,
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
      displayName: name,
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
      displayName: name,
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
      displayName: name,
      detail: `is on a ${candidate.currentStreak}-day check-in streak`,
      occurredAt: candidate.lastCheckInAt ?? new Date(),
    })
  }

  return items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit)
}
