import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ContentLikeType } from '@prisma/client'

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
  // — no feed post for a candidate whose profile isn't Public/Semi-Public.
  if (profile.privacyTier !== 'PUBLIC' && profile.privacyTier !== 'SEMI_PUBLIC') return

  await prisma.communityPost.create({
    data: {
      candidateId,
      postType: 'LIKED_CONTENT',
      description: `liked "${content.title}"`,
      postCity: profile.currentCity,
      postState: profile.currentState,
      postFunction: profile.primaryFunction,
      postIndustry: profile.industryContext,
      postIndustryBucket: profile.industryBucket,
      postMetroArea: profile.metroArea,
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
