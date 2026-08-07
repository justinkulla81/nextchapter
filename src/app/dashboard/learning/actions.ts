'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { polishAiProjectDescription } from '@/lib/learning/polish-ai-project'
import { captureServerEvent } from '@/lib/posthog/server'
import { applyLearningClosesBarrierRewrite } from '@/lib/scoring/rewrite-actions'

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

  captureServerEvent(profile.id, 'learning_recommendation_completed', { title, provider })

  try {
    await applyLearningClosesBarrierRewrite(profile.id)
  } catch (error) {
    console.error('Failed to apply learning-closes-barrier baseline rewrite:', error)
  }

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

  try {
    await applyLearningClosesBarrierRewrite(profile.id)
  } catch (error) {
    console.error('Failed to apply learning-closes-barrier baseline rewrite:', error)
  }

  revalidatePath('/dashboard/learning')
  revalidatePath('/dashboard/recruiter-report')
}

export async function dismissAiContextBanner(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { aiContextBannerDismissedAt: new Date() },
  })

  revalidatePath('/dashboard/learning')
}

// Marks a curated tool (from ai-tools-by-function.ts) as one the candidate
// already knows — toggling off deletes the row. Curated tools carry no
// toolUrl (the URL lives in the constants file, not the DB row).
export async function toggleToolFamiliarity(toolName: string, isFamiliar: boolean): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  if (isFamiliar) {
    await prisma.candidateAiToolFamiliarity.upsert({
      where: { candidateId_toolName: { candidateId: profile.id, toolName } },
      create: { candidateId: profile.id, toolName, isCustom: false },
      update: {},
    })
  } else {
    await prisma.candidateAiToolFamiliarity.deleteMany({
      where: { candidateId: profile.id, toolName, isCustom: false },
    })
  }

  captureServerEvent(profile.id, 'learning_tool_familiarity_toggled', { toolName, isFamiliar })

  revalidatePath('/dashboard/learning')
}

export type AddCustomAiToolState = { error?: string } | undefined

export async function addCustomAiTool(
  _prevState: AddCustomAiToolState,
  formData: FormData
): Promise<AddCustomAiToolState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const toolName = (formData.get('toolName') as string | null)?.trim()
  const toolUrl = (formData.get('toolUrl') as string | null)?.trim() || null
  if (!toolName) return { error: 'Enter a tool name.' }

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateAiToolFamiliarity.upsert({
    where: { candidateId_toolName: { candidateId: profile.id, toolName } },
    create: { candidateId: profile.id, toolName, toolUrl, isCustom: true },
    update: { toolUrl, isCustom: true },
  })

  captureServerEvent(profile.id, 'learning_custom_tool_added', { toolName })

  revalidatePath('/dashboard/learning')
}

export async function removeCustomAiTool(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateAiToolFamiliarity.deleteMany({ where: { id, candidateId: profile.id } })

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
