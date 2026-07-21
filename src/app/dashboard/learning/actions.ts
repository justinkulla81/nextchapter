'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { polishAiProjectDescription } from '@/lib/learning/polish-ai-project'
import { captureServerEvent } from '@/lib/posthog/server'

// One-click completion from a recommendation card — skips the manual
// title/type/date form since we already know what it is and that it's done
// today; still creates a real LearningBadge so it counts toward the
// Certified Executive Dossier the same as a manually logged one.
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

export type LogAiProjectFormState = { error?: string } | undefined

export async function logAiProject(
  _prevState: LogAiProjectFormState,
  formData: FormData
): Promise<LogAiProjectFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const title = (formData.get('title') as string | null)?.trim()
  const toolUsed = (formData.get('toolUsed') as string | null)?.trim()
  const rawDescription = (formData.get('description') as string | null)?.trim()
  const judgmentCall = (formData.get('judgmentCall') as string | null)?.trim() || null

  if (!title || !toolUsed || !rawDescription) {
    return { error: 'Please fill in the title, tool, and description.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  const polishedDescription = await polishAiProjectDescription({ title, toolUsed, rawDescription })

  await prisma.learningBadge.create({
    data: {
      candidateId: profile.id,
      title,
      provider: toolUsed,
      description: polishedDescription,
      judgmentCall,
      badgeType: 'ai_project',
      completedAt: new Date(),
    },
  })

  captureServerEvent(profile.id, 'ai_project_logged', { toolUsed })

  revalidatePath('/dashboard/learning')
  revalidatePath('/dashboard/recruiter-report')
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
