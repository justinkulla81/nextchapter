'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { markInterimMarketplaceSignupCore } from '@/lib/interim-work/mark-signup'

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
  // as privacyOpenedUpBonusAt/jobBoardUsageBonusAt. The completion flag is
  // set unconditionally, not nested inside the sprint-exists check — see
  // the comment on the equivalent block in network/actions.ts for why.
  if (!profile.gigDirectoryUnlockBonusAt) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { gigDirectoryUnlockBonusAt: new Date() },
    })
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'GIG_DIRECTORY_UNLOCK' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'GIG_DIRECTORY_UNLOCK',
        text: 'Unlock the Interim/Gig Directory',
        points: effort.points,
        estimatedMinutes: effort.minutes,
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

// Independent of eeocGenderIdentity — see the enum's comment in schema.prisma.
// This is a direct, feature-scoped question that only decides whether
// WOMEN_FOCUSED board listings (Athena Alliance, theBoardlist) show up in
// Section 4, never read anywhere else.
export async function setBoardDiversityListingsOptIn(optIn: boolean): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { boardDiversityListingsOptIn: optIn },
  })

  captureServerEvent(profile.id, 'board_diversity_listings_opt_in_set', { optIn })

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
  await markInterimMarketplaceSignupCore(profile.id, listingId, 'SELF_REPORTED')

  revalidatePath('/dashboard/interim-work', 'layout')
}
