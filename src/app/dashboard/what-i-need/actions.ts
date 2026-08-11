'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { WHAT_I_NEED_ITEMS, type ImportanceRating } from '@/lib/constants/what-i-need'

export type FormState = { error?: string } | undefined

export async function updateWhatINeed(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const profile = await getOrCreateCandidateProfile(user.id)

  const itemRatings = WHAT_I_NEED_ITEMS.map((item) => {
    const raw = formData.get(`rating__${item.id}`)
    return raw ? { itemId: item.id, rating: Number(raw) as ImportanceRating } : null
  }).filter((r): r is { itemId: string; rating: ImportanceRating } => r !== null)

  const domainRank = formData.getAll('domainRank').map(String)

  if (itemRatings.length === 0) {
    return { error: 'Please rate at least one item before saving.' }
  }

  const data = {
    candidateId: profile.id,
    itemRatings,
    domainRank,
    completedAt: new Date(),
  }

  await prisma.whatINeedResponse.upsert({
    where: { candidateId: profile.id },
    create: data,
    update: data,
  })

  captureServerEvent(profile.id, 'what_i_need_updated', {})

  if (!profile.whatINeedCompletedAt) {
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'WHAT_I_NEED_COMPLETED' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'WHAT_I_NEED_COMPLETED',
        text: 'Complete What I Need',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { whatINeedCompletedAt: new Date() },
    })
  }

  revalidatePath('/dashboard/what-i-need')
  revalidatePath('/dashboard/skills-assessments')
  revalidatePath('/dashboard')
}
