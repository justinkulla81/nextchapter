'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { recalculateScore } from '@/lib/scoring/recalculate'
import { sendPostInterestNotification } from '@/lib/email/send-post-interest-notification'

export type FormState = { error?: string } | undefined

const POST_TYPES = ['JOB', 'PROJECT', 'INTRO_OFFER'] as const

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
    return { error: 'Set your profile to Public or Semi-Public to post on the Community Board.' }
  }

  const postType = formData.get('postType') as string | null
  const title = (formData.get('title') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim()
  const externalUrl = (formData.get('externalUrl') as string | null)?.trim() || null

  if (!postType || !POST_TYPES.includes(postType as (typeof POST_TYPES)[number])) {
    return { error: 'Please choose a post type.' }
  }
  if (!title || !description) {
    return { error: 'Please fill in a title and description.' }
  }

  await prisma.communityPost.create({
    data: {
      candidateId: profile.id,
      postType: postType as (typeof POST_TYPES)[number],
      title,
      description,
      externalUrl,
      postCity: profile.currentCity,
      postState: profile.currentState,
      postFunction: profile.primaryFunction,
      postIndustry: profile.industryContext,
    },
  })

  await recalculateScore(profile.id, 'community_post_created')

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
      postTitle: post.title,
      interestedCandidateName: profile.displayName || 'A candidate',
      interestedCandidateEmail: user.email!,
    })
  }

  revalidatePath('/dashboard/community')
}
