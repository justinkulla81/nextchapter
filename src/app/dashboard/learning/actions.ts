'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'

// One-click completion from a recommendation card — skips the manual
// title/type/date form since we already know what it is and that it's done
// today; still creates a real LearningBadge so it counts toward the
// Recruiter Report the same as a manually logged one.
export async function markRecommendationCompleted(title: string, provider: string | null): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.learningBadge.create({
    data: {
      candidateId: profile.id,
      title,
      provider,
      badgeType: 'course_completed',
      completedAt: new Date(),
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
