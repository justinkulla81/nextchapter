'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { TRADEOFF_PRIORITIES } from '@/lib/constants/onboarding'
import { recomputeCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import type { GapDurationBucket } from '@prisma/client'

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

  const rankedOrder = formData.getAll('tradeoffOrder').map(String) as Array<
    (typeof TRADEOFF_PRIORITIES)[number]['key']
  >
  if (rankedOrder.length !== TRADEOFF_PRIORITIES.length) {
    return { error: `Please rank all ${TRADEOFF_PRIORITIES.length} priorities.` }
  }
  const rankValues: Record<(typeof TRADEOFF_PRIORITIES)[number]['key'], number> = {} as Record<
    (typeof TRADEOFF_PRIORITIES)[number]['key'],
    number
  >
  rankedOrder.forEach((key, index) => {
    rankValues[key] = index + 1
  })

  const targetRoleType = (formData.get('targetRoleType') as string | null)?.trim() || null
  const targetIndustries = formData.getAll('targetIndustries') as string[]
  const primaryFunction = (formData.get('primaryFunction') as string | null) || null
  const targetFunction = (formData.get('targetFunction') as string | null) || null
  const secondaryFunctionRaw = (formData.get('secondaryFunction') as string | null) || null
  const secondaryFunction = secondaryFunctionRaw === 'none' ? null : secondaryFunctionRaw
  const gapDurationRaw = (formData.get('gapDuration') as string | null) || null
  const gapDuration = gapDurationRaw === 'none' ? null : (gapDurationRaw as GapDurationBucket | null)
  const highestLevelReachedRaw = (formData.get('highestLevelReached') as string | null) || null
  const highestLevelReached = highestLevelReachedRaw === 'none' ? null : highestLevelReachedRaw
  const targetCompanySize = (formData.get('targetCompanySize') as string | null) || null
  const targetCompanyStage = (formData.get('targetCompanyStage') as string | null) || null
  const remotePreference = (formData.get('remotePreference') as string | null) || null
  const applicationVolumeGoalRaw = formData.get('applicationVolumeGoal') as string | null
  const applicationVolumeGoal = applicationVolumeGoalRaw ? Number(applicationVolumeGoalRaw) : null
  const isPivoting = formData.get('isPivoting') === 'on'
  const openToRelocation = formData.get('openToRelocation') === 'on'
  const relocationNotes = openToRelocation ? (formData.get('relocationNotes') as string | null)?.trim() || null : null
  const interimConsultingInterest = formData.get('interimConsultingInterest') === 'on'
  const compFlexible = formData.get('compFlexible') === 'on'
  const equityImportant = formData.get('equityImportant') === 'on'
  const willingToStartLower = formData.get('willingToStartLower') === 'on'
  const startLowerRationale = (formData.get('startLowerRationale') as string | null)?.trim() || null
  const dealBreakers = (formData.get('dealBreakers') as string | null)?.trim() || null

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      targetRoleType,
      targetIndustries,
      primaryFunction,
      targetFunction,
      secondaryFunction,
      gapDuration,
      highestLevelReached,
      targetCompanySize,
      targetCompanyStage,
      remotePreference,
      compFlexible,
      equityImportant,
      willingToStartLower,
      startLowerRationale,
      dealBreakers,
      applicationVolumeGoal,
      isPivoting,
      openToRelocation,
      relocationNotes,
      interimConsultingInterest,
      ...rankValues,
      searchStrategyConfirmedAt: new Date(),
      // Every input above is a direct input to the Search Strategy Guidance
      // paragraph (search-strategy-guidance.ts) — null it out so the next
      // page load regenerates against the freshly-saved values, never a
      // stale take. Never nulled on a plain page read, only here and via
      // the explicit Regenerate action below.
      searchStrategyGuidance: null,
      searchStrategyGuidanceGeneratedAt: null,
    },
  })

  captureServerEvent(profile.id, 'search_strategy_updated', {})

  // highestLevelReached feeds levelRankScore (job-fit matching sitewide) —
  // same recompute FunctionConfirmForm's confirm action triggers.
  try {
    await recomputeCandidateLevelRank(profile.id)
  } catch (error) {
    console.error('Failed to recompute level rank after search strategy update:', error)
  }

  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/hireability-report')
}

// Explicit refresh for the self-caching Search Strategy Guidance paragraph —
// same shape as regenerateDossierSections (recruiter-report/actions.ts).
// Clearing the cache column is all that's needed; the next render
// regenerates and re-caches via getOrDraftSearchStrategyGuidance.
// Deliberately candidate-initiated, for a fresh take without changing any
// form inputs — keeps generation cost tied to intent, never to page views.
export async function regenerateSearchStrategyGuidance(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { searchStrategyGuidance: null, searchStrategyGuidanceGeneratedAt: null },
  })

  captureServerEvent(profile.id, 'search_strategy_guidance_regenerated', {})

  revalidatePath('/dashboard/search-strategy')
}
