'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

export async function submitGigDirectoryUnlock(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const answer = (formData.get('answer') as string | null)?.trim()
  if (!answer) {
    return { error: 'Please answer this before continuing.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { gigDirectoryUnlockAnswer: answer },
  })

  captureServerEvent(profile.id, 'interim_launch_phase_completed', { phase: 1 })

  revalidatePath('/dashboard/gig-directory')
}

export async function submitInterimOfferDefinition(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const offer = (formData.get('offer') as string | null)?.trim()
  if (!offer) {
    return { error: 'Please describe your offer before continuing.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { interimOfferDefinition: offer },
  })

  captureServerEvent(profile.id, 'interim_launch_phase_completed', { phase: 2 })

  revalidatePath('/dashboard/gig-directory')
}

export async function markInterimOutreachStarted(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { interimOutreachStartedAt: new Date() },
  })

  captureServerEvent(profile.id, 'interim_launch_phase_completed', { phase: 6 })

  revalidatePath('/dashboard/gig-directory')
}
