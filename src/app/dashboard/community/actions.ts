'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { sendPostInterestNotification } from '@/lib/email/send-post-interest-notification'
import { sendEncouragementNote, markEncouragementNoteRead } from '@/lib/community/encouragement'
import { captureServerEvent } from '@/lib/posthog/server'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'

export type FormState = { error?: string } | undefined

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
