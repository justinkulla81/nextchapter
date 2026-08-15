import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ContentLikeType, CuratedVideo, Podcast, Webinar } from '@prisma/client'

interface LikeableContent {
  contentType: ContentLikeType
  contentId: string
  title: string
}

// Mirrors maybeCreateMilestonePost's exact pattern
// (src/lib/community/milestone-posts.ts): calls prisma.communityPost.create()
// directly, bypassing SUBMITTABLE_POST_TYPES (src/app/dashboard/community/
// actions.ts) entirely — a like is a one-click system action, not a form
// submission, so it was never meant to go through the composer's gate.
async function maybeCreateContentLikePost(candidateId: string, content: LikeableContent) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: {
      privacyTier: true,
      confidentialSearchMode: true,
      currentCity: true,
      currentState: true,
      primaryFunction: true,
      industryContext: true,
      industryBucket: true,
      metroArea: true,
    },
  })
  if (!profile) return
  // Same participation gate createCommunityPost/maybeCreateMilestonePost use
  // — no feed post for a candidate whose profile isn't Public/Semi-Public,
  // unless they're in Confidential Search Mode (still posts, under a
  // generated handle — see resolveCommunityIdentity).
  if (profile.privacyTier !== 'PUBLIC' && profile.privacyTier !== 'SEMI_PUBLIC' && !profile.confidentialSearchMode) return

  await prisma.communityPost.create({
    data: {
      candidateId,
      postType: 'LIKED_CONTENT',
      description: `liked "${content.title}"`,
      // §4.2: no location/employer for Confidential Search Mode candidates
      // — see createCommunityPost's identical comment.
      postCity: profile.confidentialSearchMode ? null : profile.currentCity,
      postState: profile.confidentialSearchMode ? null : profile.currentState,
      postFunction: profile.primaryFunction,
      postIndustry: profile.industryContext,
      postIndustryBucket: profile.industryBucket,
      postMetroArea: profile.confidentialSearchMode ? null : profile.metroArea,
      // System-generated, fixed template text (never candidate-authored
      // free text) — skips the §14 AI classifier entirely and publishes
      // directly, same reasoning as maybeCreateMilestonePost.
      moderationStatus: 'PUBLISHED',
      moderatedAt: new Date(),
    },
  })
}

// Toggle: the first Like on a given item creates the ContentLike row and —
// only on that same transition, never on a later re-click — posts to the
// Support Network feed via maybeCreateContentLikePost above. Clicking Like
// again on an already-liked item is an UNLIKE (the ContentLike row is
// deleted); the earlier feed post is left standing, same as
// CommunityPostReaction's cheer toggle never retracting anything it caused.
// This is the documented choice for the spec's "no-op or unlike, your call"
// — unlike was chosen so the Like button stays an honest, reversible
// toggle rather than a one-way action.
//
// Liking something also clears any existing ContentDislike for the same
// item — Like and Dislike are mutually exclusive (see dislikeContent in
// content-dislikes.ts for the symmetric direction).
export async function toggleContentLike(
  candidateId: string,
  content: LikeableContent
): Promise<{ liked: boolean }> {
  const existing = await prisma.contentLike.findUnique({
    where: {
      candidateId_contentType_contentId: {
        candidateId,
        contentType: content.contentType,
        contentId: content.contentId,
      },
    },
  })

  if (existing) {
    await prisma.contentLike.delete({ where: { id: existing.id } })
    return { liked: false }
  }

  await prisma.contentLike.create({
    data: { candidateId, contentType: content.contentType, contentId: content.contentId },
  })
  await prisma.contentDislike.deleteMany({
    where: { candidateId, contentType: content.contentType, contentId: content.contentId },
  })
  await maybeCreateContentLikePost(candidateId, content)
  return { liked: true }
}

// Returns every "contentType:contentId" the candidate currently has liked,
// for O(1) isLiked lookups when rendering carousel items.
export async function getCandidateContentLikeKeys(candidateId: string): Promise<Set<string>> {
  const likes = await prisma.contentLike.findMany({
    where: { candidateId },
    select: { contentType: true, contentId: true },
  })
  return new Set(likes.map((l) => contentLikeKey(l.contentType, l.contentId)))
}

export function contentLikeKey(contentType: ContentLikeType, contentId: string): string {
  return `${contentType}:${contentId}`
}

export interface CandidateFavorites {
  // CURATED_VIDEO covers both long-form and Shorts (format field on the
  // row distinguishes them, same as everywhere else) — a liked Short is a
  // favorite exactly like a liked long-form video.
  videos: CuratedVideo[]
  podcasts: Podcast[]
  webinars: Webinar[]
}

// Resolves a candidate's ContentLike rows back to their real source rows
// for the "My Favorites" section (src/app/dashboard/webinars/page.tsx). A
// liked item whose source row was removed (CuratedVideo/Podcast
// removedAt, or Webinar cancelledAt) is silently skipped — it simply isn't
// in the `in: [...ids]` result set, no error path needed. Each list is
// ordered by likedAt (most recently liked first) since `findMany({ id: {
// in } })` does not preserve the input array's order.
export async function getCandidateFavorites(candidateId: string): Promise<CandidateFavorites> {
  const likes = await prisma.contentLike.findMany({
    where: { candidateId },
    orderBy: { likedAt: 'desc' },
  })
  if (likes.length === 0) return { videos: [], podcasts: [], webinars: [] }

  const likedAtByContentId = new Map(likes.map((l) => [l.contentId, l.likedAt.getTime()]))
  const idsFor = (type: ContentLikeType) => likes.filter((l) => l.contentType === type).map((l) => l.contentId)
  const byLikedAtDesc = <T extends { id: string }>(rows: T[]): T[] =>
    [...rows].sort((a, b) => (likedAtByContentId.get(b.id) ?? 0) - (likedAtByContentId.get(a.id) ?? 0))

  const videoIds = idsFor('CURATED_VIDEO')
  const podcastIds = idsFor('PODCAST')
  const webinarIds = idsFor('WEBINAR')

  const [videos, podcasts, webinars] = await Promise.all([
    videoIds.length
      ? prisma.curatedVideo.findMany({ where: { id: { in: videoIds }, removedAt: null } })
      : Promise.resolve([]),
    podcastIds.length
      ? prisma.podcast.findMany({ where: { id: { in: podcastIds }, removedAt: null } })
      : Promise.resolve([]),
    webinarIds.length
      ? prisma.webinar.findMany({ where: { id: { in: webinarIds }, cancelledAt: null } })
      : Promise.resolve([]),
  ])

  return {
    videos: byLikedAtDesc(videos),
    podcasts: byLikedAtDesc(podcasts),
    webinars: byLikedAtDesc(webinars),
  }
}
