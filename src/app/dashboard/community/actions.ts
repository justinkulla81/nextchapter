'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { sendPostInterestNotification } from '@/lib/email/send-post-interest-notification'
import { sendEncouragementNote, markEncouragementNoteRead } from '@/lib/community/encouragement'
import { acknowledgeAutoJoinNotices, leaveCommunity } from '@/lib/community/communities'
import { captureServerEvent } from '@/lib/posthog/server'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import {
  getOrCreatePeerThread,
  sendPeerMessage,
  reportMessageThread,
  blockCandidate,
  unblockCandidate,
} from '@/lib/messaging/peer-threads'
import { classifyCommunityPost, moderationOutcome, type ModerationOutcome } from '@/lib/community/moderation'
import { canParticipateInCommunity } from '@/lib/community/access'
import { resolveCommunityIdentity } from '@/lib/community/identity'
import type { CommunityModerationCategory, CommunityModerationStatus } from '@prisma/client'

export type FormState = { error?: string } | undefined

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export type SendPeerMessageState = { error?: string } | undefined

// Starts the thread on the caller's first send if it doesn't already exist
// (see the "Message" link on CommunityPostCard, which deep-links here via
// ?tab=peer&with={candidateId} without a threadId yet).
export async function sendPeerCandidateMessage(
  _prevState: SendPeerMessageState,
  formData: FormData
): Promise<SendPeerMessageState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const threadId = formData.get('threadId') as string | null
  const otherCandidateId = formData.get('otherCandidateId') as string | null
  const body = (formData.get('body') as string | null) ?? ''

  try {
    const thread = threadId
      ? { id: threadId }
      : otherCandidateId
        ? await getOrCreatePeerThread(profile.id, otherCandidateId)
        : null
    if (!thread) return { error: 'Conversation not found.' }
    await sendPeerMessage(thread.id, profile.id, body)
    captureServerEvent(profile.id, 'peer_message_sent', { threadId: thread.id })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not send message.' }
  }

  revalidatePath('/dashboard/community')
  return undefined
}

// Generalized (Phase 3 of the Community/Messaging rework) to cover Coach/
// Recruiter/Employer threads too, not just Peer — see reportMessageThread's
// own comment.
export async function reportMessageThreadAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const threadId = formData.get('threadId') as string | null
  const reason = (formData.get('reason') as string | null) ?? ''
  if (!threadId) return { error: 'Conversation not found.' }

  try {
    await reportMessageThread(threadId, profile.id, reason)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not report this conversation.' }
  }

  captureServerEvent(profile.id, 'message_thread_reported', { threadId })
  revalidatePath('/dashboard/community')
  return { error: undefined }
}

// Extends the same report mechanism to feed posts (Phase 3), reusing
// CommunityPost.reportedAt/reportedByCandidateId/reportReason added in the
// schema phase of this rework.
export async function reportCommunityPostAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const postId = formData.get('postId') as string | null
  const reason = (formData.get('reason') as string | null) ?? ''
  if (!postId) return { error: 'Post not found.' }

  await prisma.communityPost.update({
    where: { id: postId },
    data: { reportedAt: new Date(), reportedByCandidateId: profile.id, reportReason: reason.trim() || null },
  })

  captureServerEvent(profile.id, 'community_post_reported', { postId })
  revalidatePath('/dashboard/community')
  return { error: undefined }
}

// Immediate, candidate-controlled, no approval from the other person or an
// admin required — the block takes effect the moment this returns.
export async function blockPeerCandidateAction(otherCandidateId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return
  await blockCandidate(profile.id, otherCandidateId)
  captureServerEvent(profile.id, 'peer_candidate_blocked', { blockedCandidateId: otherCandidateId })
  revalidatePath('/dashboard/community')
}

// Only the person who placed the block can lift it.
export async function unblockPeerCandidateAction(otherCandidateId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return
  await unblockCandidate(profile.id, otherCandidateId)
  captureServerEvent(profile.id, 'peer_candidate_unblocked', { unblockedCandidateId: otherCandidateId })
  revalidatePath('/dashboard/community')
}

// The composer only ever creates one of these two types now (message-only,
// no type picker) — JOB/PROJECT/INTRO_OFFER remain valid enum values for
// historical posts but are no longer creatable from the UI.
const SUBMITTABLE_POST_TYPES = ['UPDATE', 'SELF_INTRO'] as const

// §14's auto-remove categories still get "notify poster" — since
// classification runs synchronously before the response returns, the
// cheapest honest way to notify them is inline, in the same response,
// rather than a separate email for something the poster is about to read
// anyway.
function removalMessage(category: CommunityModerationCategory | null): string {
  if (category === 'DOXXING_PII') {
    return "This post wasn't published — it looked like it included someone else's personal contact information. Remove that and try again."
  }
  if (category === 'SPAM_PROMOTION') {
    return "This post wasn't published — it read as spam or an off-topic promotion. This board is for real search-related updates: job leads, asks, and offers to help."
  }
  return "This post wasn't published — it didn't meet Community guidelines."
}

export type CreateCommunityPostState = { error?: string; notice?: string; showSupportLink?: boolean } | undefined

export async function createCommunityPost(
  _prevState: CreateCommunityPostState,
  formData: FormData
): Promise<CreateCommunityPostState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  // Never trust a client-side gate alone — re-check server-side. §14's real
  // gate is a qualifying milestone badge, privacy tier alone is no longer
  // sufficient — see community/access.ts's own comment for why both still
  // matter (and why Confidential Search Mode candidates pass the
  // visibility half of this gate too).
  if (!(await canParticipateInCommunity(profile.id, profile.privacyTier, profile.confidentialSearchMode))) {
    return { error: "Community unlocks once your profile is Public or Semi-Public (or you're in Confidential Search Mode) and you've earned any milestone badge." }
  }

  const postType = formData.get('postType') as string | null
  const description = (formData.get('description') as string | null)?.trim()
  const externalUrl = (formData.get('externalUrl') as string | null)?.trim() || null

  if (!postType || !SUBMITTABLE_POST_TYPES.includes(postType as (typeof SUBMITTABLE_POST_TYPES)[number])) {
    return { error: 'Something went wrong — please try again.' }
  }
  if (!description) {
    return { error: 'Write something first.' }
  }

  // Snapshot-at-post-time, same convention as postCity/postFunction/
  // postIndustry above — read from the candidate's education/work-history/
  // resume-analysis relations so group- and seniority-filtered feed views
  // can match against them later without a join back to data that may since
  // have changed.
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
  // Silently blocking a clean post until a human clears it is the safer
  // failure mode of the two.
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
  // REMOVED posts are still persisted (never silently dropped) so the admin
  // moderation queue has a real audit trail, but isActive:false keeps them
  // out of every other query that already filters on isActive.
  const isActive = outcome !== 'REMOVE'

  // §4.2: "No employer, title, or location on the profile" for Confidential
  // Search Mode candidates. Stripped at write time (not just at render) so
  // it's never available to leak through any future rendering surface —
  // postFunction/postIndustry/postIndustryBucket/postSeniorityBand are kept
  // (broad categories for Community "peers like you" groups, not employer
  // or location) but city/state/metro and company names are not.
  const post = await prisma.communityPost.create({
    data: {
      candidateId: profile.id,
      postType: postType as (typeof SUBMITTABLE_POST_TYPES)[number],
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
  // automatically instead of requiring a separate self-report toggle in the
  // Weekly Search Sprint. Scoped to UPDATE only (not SELF_INTRO, a one-time
  // onboarding milestone rather than the ongoing "share" behavior this
  // rewards), and skipped for auto-removed posts (spam/doxxing isn't real
  // search effort) — held/published posts still earn it, since a
  // false-positive hold shouldn't cost a candidate their points.
  if (postType === 'UPDATE' && outcome !== 'REMOVE') {
    await autoCompleteEngagementAction(profile.id, {
      actionType: 'ENGAGE_POST_UPDATE',
      text: 'Post an update on your own progress',
      points: 10,
      estimatedMinutes: 10,
    })
  }

  revalidatePath('/dashboard/community')
  revalidatePath('/dashboard')

  if (outcome === 'REMOVE') {
    return { error: removalMessage(category) }
  }
  if (outcome === 'HOLD') {
    return { notice: "Your post is being held for a quick review before it goes live — check back in a bit." }
  }
  // Crisis/self-harm: never held, never removed (§17 rule #12) — published
  // immediately, flagged for priority human review, and the poster is
  // pointed toward Support During Transition right here, not via a
  // notification they'd have to go find. See moderation.ts's own comment
  // for why this platform runs automated detection here but deliberately
  // not on private intake answers.
  if (category === 'CRISIS_SELF_HARM') {
    return {
      notice:
        'Your post is live. If things feel heavy right now, Support During Transition has some resources that might help — no pressure, just there if you want it.',
      showSupportLink: true,
    }
  }
  return undefined
}

export async function deactivateCommunityPost(postId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.communityPost.updateMany({
    where: { id: postId, candidateId: profile.id },
    data: { isActive: false },
  })

  captureServerEvent(profile.id, 'community_post_deactivated', { postId })
  revalidatePath('/dashboard/community')
}

export type EncouragementFormState = { error?: string; sent?: boolean } | undefined

export async function submitEncouragementNote(
  _prevState: EncouragementFormState,
  formData: FormData
): Promise<EncouragementFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const profile = await getOrCreateCandidateProfile(user.id)
  if (!profile.encouragementGivingOptIn) {
    return { error: 'Opt in to giving encouragement from Privacy settings first.' }
  }

  const message = (formData.get('message') as string | null)?.trim()
  if (!message) return { error: 'Write a short note first.' }

  // Confidential Search Mode never reveals a real name to another member —
  // "name mode unavailable" (§4.2) extends to encouragement notes too, even
  // though they're a separate subsystem from Community posts. Enforced
  // here server-side, not just by hiding the checkbox client-side.
  const revealSender = formData.get('revealSender') === 'on' && !profile.confidentialSearchMode
  const result = await sendEncouragementNote(profile.id, message, revealSender)
  revalidatePath('/dashboard/community')

  if (!result.sent) {
    return { error: 'No one needs a note right now — check back later.' }
  }
  captureServerEvent(profile.id, 'encouragement_note_sent', { revealSender })
  return { sent: true }
}

export async function dismissEncouragementNote(noteId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await markEncouragementNoteRead(noteId, profile.id)
  captureServerEvent(profile.id, 'encouragement_note_dismissed', { noteId })
  revalidatePath('/dashboard/community')
}

export async function toggleEncouragementGiving(current: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { encouragementGivingOptIn: !current },
  })
  captureServerEvent(profile.id, 'encouragement_giving_toggled', { enabled: !current })
  revalidatePath('/dashboard/community')
  revalidatePath('/dashboard/privacy')
}

export async function toggleWeeklySprintTargetOptOut(current: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { weeklySprintTargetOptOut: !current },
  })
  captureServerEvent(profile.id, 'weekly_sprint_target_opt_out_toggled', { optedOut: !current })
  revalidatePath('/dashboard/privacy')
}

export async function expressInterest(postId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  if (!(await canParticipateInCommunity(profile.id, profile.privacyTier, profile.confidentialSearchMode))) {
    return
  }

  const post = await prisma.communityPost.findUnique({ where: { id: postId } })
  if (!post || !post.isActive || post.moderationStatus !== 'PUBLISHED') return

  try {
    await prisma.communityPostInterest.create({
      data: { postId, interestedCandidateId: profile.id },
    })
  } catch (error) {
    // Unique constraint violation — already expressed interest, no-op.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return
    }
    throw error
  }

  const posterProfile = await prisma.candidateProfile.findUnique({ where: { id: post.candidateId } })
  if (!posterProfile) return

  const admin = createAdminClient()
  const { data: posterUserData } = await admin.auth.admin.getUserById(posterProfile.userId)
  const posterEmail = posterUserData.user?.email

  if (posterEmail) {
    await sendPostInterestNotification({
      posterEmail,
      postTitle: post.title || post.description.slice(0, 60),
      interestedCandidateName: resolveCommunityIdentity(profile).displayName ?? 'A candidate',
      interestedCandidateEmail: user.email!,
    })
  }

  captureServerEvent(profile.id, 'community_interest_expressed', { postId })

  revalidatePath('/dashboard/community')
}

// Single toggle-only reaction (not a picker — see CommunityPostReaction's
// schema comment). Mirrors expressInterest's unique-constraint idempotency
// pattern for the "on" side; the "off" side is a plain delete since leaving
// a reaction is never itself an error condition.
export async function toggleCheerPostAction(postId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  const existing = await prisma.communityPostReaction.findUnique({
    where: { postId_candidateId: { postId, candidateId: profile.id } },
  })

  if (existing) {
    await prisma.communityPostReaction.delete({ where: { id: existing.id } })
    captureServerEvent(profile.id, 'community_post_cheered', { postId, cheered: false })
  } else {
    // Only the "add a cheer" side is gated — removing your own reaction is
    // always allowed, same reasoning as expressInterest/createCommunityPost
    // never gating report/block below.
    if (!(await canParticipateInCommunity(profile.id, profile.privacyTier, profile.confidentialSearchMode))) {
      return
    }
    try {
      await prisma.communityPostReaction.create({ data: { postId, candidateId: profile.id } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Already cheered from a concurrent request — no-op.
      } else {
        throw error
      }
    }
    captureServerEvent(profile.id, 'community_post_cheered', { postId, cheered: true })
  }

  revalidatePath('/dashboard/community')
}

export async function acknowledgeAutoJoinNoticesAction() {
  const profile = await getAuthedProfile()
  if (!profile) return

  await acknowledgeAutoJoinNotices(profile.id)
  captureServerEvent(profile.id, 'community_auto_join_acknowledged', {})
  revalidatePath('/dashboard/community')
}

export async function leaveCommunityAction(communityId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await leaveCommunity(profile.id, communityId)
  captureServerEvent(profile.id, 'community_left', { communityId })
  revalidatePath('/dashboard/community')
}
