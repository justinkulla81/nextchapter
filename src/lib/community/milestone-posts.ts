import 'server-only'
import { prisma } from '@/lib/prisma'

// Turns a badge earn into a real, reactable, removable CommunityPost instead
// of the synthetic feed item community-feed.ts used to build straight off
// WeeklyBadgeEarned — same postCity/postFunction/postIndustry snapshot
// pattern createCommunityPost uses, same privacy/opt-out gates the old
// synthetic item already respected. Idempotent per candidate+week so it's
// safe to call every time computeWeeklyBadges recomputes (which happens on
// every dashboard load, not just once).
export async function maybeCreateMilestonePost(candidateId: string, weekStartDate: Date) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: {
      privacyTier: true,
      weeklySprintTargetOptOut: true,
      currentCity: true,
      currentState: true,
      primaryFunction: true,
      industryContext: true,
      industryBucket: true,
      metroArea: true,
    },
  })
  if (!profile) return
  if (profile.privacyTier !== 'PUBLIC' && profile.privacyTier !== 'SEMI_PUBLIC') return
  if (profile.weeklySprintTargetOptOut) return

  const weekEnd = new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000)
  const existing = await prisma.communityPost.findFirst({
    where: { candidateId, postType: 'MILESTONE', createdAt: { gte: weekStartDate, lt: weekEnd } },
    select: { id: true },
  })
  if (existing) return

  await prisma.communityPost.create({
    data: {
      candidateId,
      postType: 'MILESTONE',
      description: 'hit this week’s Sprint Target',
      postCity: profile.currentCity,
      postState: profile.currentState,
      postFunction: profile.primaryFunction,
      postIndustry: profile.industryContext,
      postIndustryBucket: profile.industryBucket,
      postMetroArea: profile.metroArea,
    },
  })
}
