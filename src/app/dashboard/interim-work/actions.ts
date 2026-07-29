'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { logCatalogAction, getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'

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

  // One-time bonus for answering the unlock question at all — same shape
  // as privacyOpenedUpBonusAt/jobBoardUsageBonusAt.
  if (!profile.gigDirectoryUnlockBonusAt) {
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'GIG_DIRECTORY_UNLOCK' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'GIG_DIRECTORY_UNLOCK',
        text: 'Unlocked the Interim/Gig Directory',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
      await prisma.candidateProfile.update({
        where: { id: profile.id },
        data: { gigDirectoryUnlockBonusAt: new Date() },
      })
    }
  }

  revalidatePath('/dashboard/interim-work')
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

  revalidatePath('/dashboard/interim-work')
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

  revalidatePath('/dashboard/interim-work')
}

// Self-report "I created a profile" checkbox on a marketplace listing (Prompt
// 68 section 2/3). @@unique([candidateId, listingId]) on InterimMarketplaceSignup
// makes this naturally idempotent — a repeat submit for the same listing is a
// no-op via skipDuplicates, so it can't be farmed for repeat points.
export async function markInterimMarketplaceSignup(listingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  const listing = await prisma.interimListing.findUnique({ where: { id: listingId } })
  if (!listing) return

  const result = await prisma.interimMarketplaceSignup.createMany({
    data: [{ candidateId: profile.id, listingId }],
    skipDuplicates: true,
  })

  // Only award points/log the action the first time — skipDuplicates means a
  // repeat click here did nothing, so don't double-count it.
  if (result.count > 0) {
    const effort = estimateActionEffort({ actionType: 'INTERIM_PROFILE_CREATED' })
    await logCatalogAction(profile.id, {
      text: `Created a profile on ${listing.name}`,
      actionType: 'INTERIM_PROFILE_CREATED',
      points: effort.points,
      estimatedMinutes: effort.minutes,
      recurring: false,
    })
    captureServerEvent(profile.id, 'interim_marketplace_signup_logged', {
      listingId,
      listingName: listing.name,
    })
  }

  revalidatePath('/dashboard/interim-work', 'layout')
}
