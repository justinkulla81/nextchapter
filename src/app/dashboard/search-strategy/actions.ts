'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

export async function updateSearchStrategy(
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

  const profile = await getOrCreateCandidateProfile(user.id)

  const targetRoleType = (formData.get('targetRoleType') as string | null)?.trim() || null
  const targetIndustries = formData.getAll('targetIndustries') as string[]
  const primaryFunction = (formData.get('primaryFunction') as string | null) || null
  const targetCompanySize = (formData.get('targetCompanySize') as string | null) || null
  const targetCompanyStage = (formData.get('targetCompanyStage') as string | null) || null
  const applicationVolumeGoalRaw = formData.get('applicationVolumeGoal') as string | null
  const applicationVolumeGoal = applicationVolumeGoalRaw ? Number(applicationVolumeGoalRaw) : null
  const skillsStillNeeded = (formData.get('skillsStillNeeded') as string | null)?.trim() || null
  const isPivoting = formData.get('isPivoting') === 'on'
  const openToRelocation = formData.get('openToRelocation') === 'on'
  const interimConsultingInterest = formData.get('interimConsultingInterest') === 'on'
  const compFlexible = formData.get('compFlexible') === 'on'
  const equityImportant = formData.get('equityImportant') === 'on'
  const willingToStartLower = formData.get('willingToStartLower') === 'on'
  const startLowerRationale = (formData.get('startLowerRationale') as string | null)?.trim() || null
  const dealBreakers = (formData.get('dealBreakers') as string | null)?.trim() || null

  const targetCompMinThousandsRaw = formData.get('targetCompMinThousands')
  // The field asks for a value "in thousands" (e.g. 120 for $120k), but
  // people occasionally type the full dollar figure by mistake (e.g. 120000).
  // Nobody realistically means "$10M+ minimum comp" via this field, so
  // treat anything that large as a raw-dollar entry and best-guess correct
  // it down to thousands rather than silently storing an absurd number.
  const targetCompMinThousandsEntered = targetCompMinThousandsRaw ? Number(targetCompMinThousandsRaw) : null
  const targetCompMinThousands =
    targetCompMinThousandsEntered !== null && targetCompMinThousandsEntered >= 10000
      ? Math.round(targetCompMinThousandsEntered / 1000)
      : targetCompMinThousandsEntered

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      targetRoleType,
      targetIndustries,
      primaryFunction,
      targetCompanySize,
      targetCompanyStage,
      targetCompMin: targetCompMinThousands ? targetCompMinThousands * 1000 : null,
      compFlexible,
      equityImportant,
      willingToStartLower,
      startLowerRationale,
      dealBreakers,
      applicationVolumeGoal,
      skillsStillNeeded,
      isPivoting,
      openToRelocation,
      interimConsultingInterest,
      searchStrategyConfirmedAt: new Date(),
    },
  })

  captureServerEvent(profile.id, 'search_strategy_updated', {})

  revalidatePath('/dashboard/search-strategy')
}
