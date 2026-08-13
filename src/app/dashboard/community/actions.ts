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

function canParticipate(privacyTier: string) {
  return privacyTier === 'PUBLIC' || privacyTier === 'SEMI_PUBLIC'
}

export async function createCommunityPost(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  // Never trust a client-side gate alone — re-check server-side.
  if (!canParticipate(profile.privacyTier)) {
    return { error: 'Set your profile to Public or Semi-Public to post to the Community.' }
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
  // postIndustry above — read from the candidate's education/work-history
  // relations so group-filtered feed views can match against them later
  // without a join back to a profile that may since have changed.
  const [primarySchool, recentCompanies] = await Promise.all([
    prisma.educationEntry.findFirst({ where: { candidateId: profile.id, isPrimary: true }, select: { schoolNameNormalized: true } }),
    prisma.workHistoryEntry.findMany({
      where: { candidateId: profile.id },
      orderBy: { startDate: 'desc' },
      select: { companyNameNormalized: true },
      distinct: ['companyNameNormalized'],
      take: 3,
    }),
  ])

  const post = await prisma.communityPost.create({
    data: {
      candidateId: profile.id,
      postType: postType as (typeof SUBMITTABLE_POST_TYPES)[number],
      description,
      externalUrl,
      postCity: profile.currentCity,
      postState: profile.currentState,
      postFunction: profile.primaryFunction,
      postIndustry: profile.industryContext,
      postIndustryBucket: profile.industryBucket,
      postMetroArea: profile.metroArea,
      postSchools: primarySchool?.schoolNameNormalized ? [primarySchool.schoolNameNormalized] : [],
      postCompanies: recentCompanies.map((c) => c.companyNameNormalized).filter(Boolean),
    },
  })

  captureServerEvent(profile.id, 'community_post_created', { postId: post.id, postType })

  // Sharing an update is real, verifiable effort — award the points
  // automatically instead of requiring a separate self-report toggle in the
  // Weekly Search Sprint. Scoped to UPDATE only (not SELF_INTRO, a one-time
  // onboarding milestone rather than the ongoing "share" behavior this
  // rewards).
  if (postType === 'UPDATE') {
    await autoCompleteEngagementAction(profile.id, {
      actionType: 'ENGAGE_POST_UPDATE',
      text: 'Post an update on your own progress',
      points: 10,
      estimatedMinutes: 10,
    })
  }

  revalidatePath('/dashboard/community')
  revalidatePath('/dashboard')
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

  const revealSender = formData.get('revealSender') === 'on'
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

  if (!canParticipate(profile.privacyTier)) {
    return
  }

  const post = await prisma.communityPost.findUnique({ where: { id: postId } })
  if (!post || !post.isActive) return

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
      interestedCandidateName: profile.displayName || 'A candidate',
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
