'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'

export type FormState = { error?: string } | undefined

const BADGE_TYPES = ['course_completed', 'certification', 'ai_project', 'conference_talk', 'published']

export async function addLearningBadge(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const title = (formData.get('title') as string | null)?.trim()
  const provider = (formData.get('provider') as string | null)?.trim() || null
  const badgeType = formData.get('badgeType') as string | null
  const completedAtRaw = formData.get('completedAt') as string | null
  const verificationUrl = (formData.get('verificationUrl') as string | null)?.trim() || null

  if (!title || !badgeType || !BADGE_TYPES.includes(badgeType)) {
    return { error: 'Please fill in what you completed and its type.' }
  }

  const completedAt = completedAtRaw ? new Date(completedAtRaw) : null
  if (!completedAt || Number.isNaN(completedAt.getTime())) {
    return { error: 'Please enter a valid completion date.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.learningBadge.create({
    data: {
      candidateId: profile.id,
      title,
      provider,
      badgeType,
      completedAt,
      verificationUrl,
    },
  })

  revalidatePath('/dashboard/learning')
}

export async function deleteLearningBadge(badgeId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.learningBadge.deleteMany({
    where: { id: badgeId, candidateId: profile.id },
  })

  revalidatePath('/dashboard/learning')
}
