import 'server-only'
import { prisma } from '@/lib/prisma'
import { classifyCommunityPost, moderationOutcome, type ModerationOutcome } from '@/lib/community/moderation'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { captureServerEvent } from '@/lib/posthog/server'
import type { CandidateProfile, CommunityModerationCategory, CommunityModerationStatus } from '@prisma/client'

export interface CreateCommunityPostInput {
  postType: 'UPDATE' | 'JOB' | 'PROJECT' | 'INTRO_OFFER' | 'SELF_INTRO'
  description: string
  externalUrl?: string | null
}

export interface CreateCommunityPostResult {
  postId: string
  outcome: ModerationOutcome
  category: CommunityModerationCategory | null
}

// Shared by the manual composer (createCommunityPost in
// dashboard/community/actions.ts) and any other real path that produces a
// genuine candidate update worth sharing to the feed (see
// postToLinkedInAction in marketing-plan/actions.ts) — same classification,
// snapshot fields, moderation outcome, and points award either way, so a
// LinkedIn-published post is never treated as lower-scrutiny than one typed
// directly into the Community composer.
export async function createModeratedCommunityPost(
  profile: CandidateProfile,
  { postType, description, externalUrl = null }: CreateCommunityPostInput
): Promise<CreateCommunityPostResult> {
  const [primarySchool, recentCompanies, latestResumeAnalysis] = await Promise.all([
    prisma.educationEntry.findFirst({ where: { candidateId: profile.id, isPrimary: true }, select: { schoolNameNormalized: true } }),
    prisma.workHistoryEntry.findMany({
      where: { candidateId: profile.id },
      orderBy: { startDate: 'desc' },
      select: { companyNameNormalized: true },
      distinct: ['companyNameNormalized'],
      take: 3,
    }),
    prisma.resumeAnalysis.findFirst({
      where: { candidateId: profile.id },
      orderBy: { createdAt: 'desc' },
      select: { seniorityBand: true },
    }),
  ])

  // §14 — every post is classified before it's visible to anyone but its
  // author. A classifier failure fails CLOSED: held for manual review, same
  // as an auto-hold category, rather than publishing unmoderated content.
  let category: CommunityModerationCategory | null = null
  let confidence: number | null = null
  let reasoning = 'Automated classification failed before this post could be reviewed — held for manual review.'
  let outcome: ModerationOutcome = 'HOLD'
  try {
    const classification = await classifyCommunityPost(description)
    category = classification.category
    confidence = classification.confidenceScore
    reasoning = classification.reasoning
    outcome = moderationOutcome(category)
  } catch (error) {
    console.error('Community post classification failed:', error)
  }

  const moderationStatus: CommunityModerationStatus =
    outcome === 'HOLD' ? 'HELD' : outcome === 'REMOVE' ? 'REMOVED' : 'PUBLISHED'
  const isActive = outcome !== 'REMOVE'

  // §4.2: "No employer, title, or location on the profile" for Confidential
  // Search Mode candidates — stripped at write time, never just at render.
  const post = await prisma.communityPost.create({
    data: {
      candidateId: profile.id,
      postType,
      description,
      externalUrl,
      postCity: profile.confidentialSearchMode ? null : profile.currentCity,
      postState: profile.confidentialSearchMode ? null : profile.currentState,
      postFunction: profile.primaryFunction,
      postIndustry: profile.industryContext,
      postIndustryBucket: profile.industryBucket,
      postMetroArea: profile.confidentialSearchMode ? null : profile.metroArea,
      postSchools: primarySchool?.schoolNameNormalized ? [primarySchool.schoolNameNormalized] : [],
      postCompanies: profile.confidentialSearchMode
        ? []
        : recentCompanies.map((c) => c.companyNameNormalized).filter(Boolean),
      postSeniorityBand: latestResumeAnalysis?.seniorityBand ?? null,
      isActive,
      moderationStatus,
      moderationCategory: category,
      moderationConfidence: confidence,
      moderationReasoning: reasoning,
      moderatedAt: new Date(),
    },
  })

  captureServerEvent(profile.id, 'community_post_created', { postId: post.id, postType })
  captureServerEvent(profile.id, 'community_post_moderated', { postId: post.id, category, outcome, confidence })

  // Sharing an update is real, verifiable effort — award the points
  // automatically. Scoped to UPDATE only, same as the original inline
  // logic — SELF_INTRO/JOB/PROJECT/INTRO_OFFER don't earn this.
  if (postType === 'UPDATE' && outcome !== 'REMOVE') {
    await autoCompleteEngagementAction(profile.id, {
      actionType: 'ENGAGE_POST_UPDATE',
      text: 'Post an update on your own progress',
      points: 10,
      estimatedMinutes: 10,
    })
  }

  return { postId: post.id, outcome, category }
}
