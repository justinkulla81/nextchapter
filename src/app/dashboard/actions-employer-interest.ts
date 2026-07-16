'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export async function approveEmployerInterest(interactionId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const interaction = await prisma.candidateInteraction.findFirst({
    where: { id: interactionId, candidateId: profile.id },
  })
  if (!interaction) return

  await prisma.$transaction([
    prisma.approvedEmployer.upsert({
      where: { candidateId_employerId: { candidateId: profile.id, employerId: interaction.employerId } },
      update: {},
      create: { candidateId: profile.id, employerId: interaction.employerId },
    }),
    prisma.candidateInteraction.update({
      where: { id: interactionId },
      data: { status: 'CANDIDATE_REVEALED' },
    }),
  ])

  captureServerEvent(profile.id, 'employer_interest_approved', {
    candidateId: profile.id,
    employerId: interaction.employerId,
  })

  revalidatePath('/dashboard')
}

export async function declineEmployerInterest(interactionId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const interaction = await prisma.candidateInteraction.findFirst({
    where: { id: interactionId, candidateId: profile.id },
  })
  if (!interaction) return

  await prisma.candidateInteraction.update({
    where: { id: interactionId },
    data: { status: 'PASSED' },
  })

  captureServerEvent(profile.id, 'employer_interest_declined', {
    candidateId: profile.id,
    employerId: interaction.employerId,
  })

  revalidatePath('/dashboard')
}
