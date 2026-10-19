'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { buildCareer, isCareerAnswered } from '@/lib/journey/career'
import { maybeAwardSearchStrategyCompleteBonus } from '@/lib/weekly/search-strategy-complete'
import type { Prisma } from '@prisma/client'

export type CareerFormState = { error?: string; saved?: boolean } | undefined

export async function saveCareerGoals(_prev: CareerFormState, formData: FormData): Promise<CareerFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Your session ended. Sign in again, then save.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  const career = buildCareer({
    focus: formData.get('focus') as string | null,
    intent: formData.get('intent') as string | null,
    nextLevel: formData.get('nextLevel') as string | null,
    reviewDate: (formData.get('reviewDate') as string | null) || null,
  })
  if (!isCareerAnswered(career)) return { error: 'Choose what matters most and where you see the next year, then save.' }
  const current = await prisma.candidateProfile.findUnique({ where: { id: profile.id }, select: { journeyDetails: true } })
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { journeyDetails: { ...((current?.journeyDetails as Record<string, unknown> | null) ?? {}), career } as Prisma.InputJsonValue },
  })
  captureServerEvent(profile.id, 'career_goals_saved', { focus: career.focus, intent: career.intent, hasNextLevel: !!career.nextLevel, hasReviewDate: !!career.reviewDate })
  await maybeAwardSearchStrategyCompleteBonus(profile.id)
  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard')
  return { saved: true }
}
