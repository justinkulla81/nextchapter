'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

// Prompt 72 — replaces the old submitBenefitsUnlock (free-text answer +
// LLM plan generation). Reads the structured multi-select instead; the
// action plan itself is derived deterministically at render time from
// benefitsPressures (see src/lib/benefits/action-plan.ts), so nothing is
// generated or stored here beyond the raw selections.
export async function submitBenefitsPressures(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const pressures = formData.getAll('pressures').map((v) => v.toString())
  if (pressures.length === 0) {
    return { error: 'Select at least one option before continuing.' }
  }

  const otherText = pressures.includes('OTHER')
    ? (formData.get('otherText') as string | null)?.trim() || null
    : null

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      benefitsPressures: pressures,
      benefitsPressureOtherText: otherText,
    },
  })

  captureServerEvent(profile.id, 'benefits_pressures_submitted', { pressures })
  revalidatePath('/dashboard/benefits')
}

// Plain completion tracking for the action-plan cards — not a Search
// Action, so no points/effort logic, just a toggled id in the list.
export async function toggleBenefitsActionItem(itemId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  const current = profile.benefitsActionPlanCompletedItems
  const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { benefitsActionPlanCompletedItems: next },
  })

  revalidatePath('/dashboard/benefits')
}
