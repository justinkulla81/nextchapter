'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { TRADEOFF_PRIORITIES } from '@/lib/constants/onboarding'
import { recomputeCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import { maybeAwardSearchStrategyCompleteBonus } from '@/lib/weekly/search-strategy-complete'
import { setBoardAdvisoryWillingness } from '@/lib/search-strategy/board-advisory-willingness'
import { answerBenefitsPriorities, answerOptionalQuestions } from '@/app/dashboard/complete-profile/actions'
import type {
  ContentVenue,
  GapDurationBucket,
  NetworkComfortLevel,
  NetworkingAnxiety,
  PublicDisclosureComfort,
  ReferralRecency,
} from '@prisma/client'

export type FormState = { error?: string } | undefined

// Same auto-correct as complete-profile/actions.ts's parseCompMinThousands —
// entering the full dollar amount (e.g. 120000) is treated the same as
// entering it in thousands (120).
function parseCompMinThousands(raw: FormDataEntryValue | null): number | null {
  const entered = raw ? Number(raw) : null
  if (!entered) return null
  return entered >= 10000 ? Math.round(entered / 1000) : entered
}

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
  const willingToFollowUpOnApplications = formData.get('willingToFollowUpOnApplications') === 'on'
  const targetCompMinThousands = parseCompMinThousands(formData.get('targetCompMinThousands'))
  const targetCompMin = targetCompMinThousands ? targetCompMinThousands * 1000 : null
  const isPivoting = formData.get('isPivoting') === 'on'
  const openToRelocation = formData.get('openToRelocation') === 'on'
  const relocationNotes = openToRelocation ? (formData.get('relocationNotes') as string | null)?.trim() || null : null
  const travelWillingness = formData.get('travelWillingness') === 'on'
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
      willingToFollowUpOnApplications,
      isPivoting,
      openToRelocation,
      relocationNotes,
      travelWillingness,
      interimConsultingInterest,
      // Only overwrite when a value was actually entered here — this field
      // is also editable from Search Goals (BenefitsPrioritiesForm), and an
      // empty submit from this page shouldn't silently blank out a value
      // set over there.
      ...(targetCompMin !== null && { targetCompMin }),
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

  await maybeAwardSearchStrategyCompleteBonus(profile.id)

  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/market-reality')
}

// Consolidates the two unlock gates that used to live directly on My
// Marketing Plan (ThoughtLeadershipUnlockForm) and LinkedIn
// (LinkedInUnlockForm) — same fields, same one-time bonus-award pattern,
// just asked once up front on Search Strategy instead of behind two
// separate locked pages. Those two pages now read straight off these
// fields (contentComfortLevel/contentVenues, linkedinOpennessComfort/
// linkedinUsageFrequency/linkedinProfileUpToDate) rather than rendering
// their own gate form.
export async function updateMarketingPlanWillingness(
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

  const publicDisclosureComfort = (formData.get('publicDisclosureComfort') as PublicDisclosureComfort | null) || null
  const contentVenues = formData.getAll('contentVenues') as ContentVenue[]
  const contentComfortLevelRaw = formData.get('contentComfortLevel') as string | null
  const contentComfortLevel = contentComfortLevelRaw ? Number(contentComfortLevelRaw) : null
  const linkedinOpennessComfortRaw = formData.get('linkedinOpennessComfort') as string | null
  const linkedinOpennessComfort = linkedinOpennessComfortRaw ? Number(linkedinOpennessComfortRaw) : null
  const linkedinUsageFrequency = (formData.get('linkedinUsageFrequency') as string | null) || null
  const profileUpToDateRaw = (formData.get('linkedinProfileUpToDate') as string | null) || null

  if (!publicDisclosureComfort) {
    return { error: 'Please answer how comfortable you are being publicly visible as job-searching.' }
  }
  if (contentVenues.length === 0 || contentComfortLevel === null) {
    return { error: 'Please answer the thought leadership questions.' }
  }
  if (linkedinOpennessComfort === null || !linkedinUsageFrequency || !profileUpToDateRaw) {
    return { error: 'Please answer the LinkedIn openness questions.' }
  }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      publicDisclosureComfort,
      contentVenues,
      contentComfortLevel,
      linkedinOpennessComfort,
      linkedinUsageFrequency,
      linkedinProfileUpToDate: profileUpToDateRaw === 'yes',
    },
  })

  captureServerEvent(profile.id, 'thought_leadership_unlocked')
  captureServerEvent(profile.id, 'linkedin_tool_unlocked', { usageFrequency: linkedinUsageFrequency })

  // No per-field points here anymore — Search Strategy's 7 pages only ever
  // award the one SEARCH_STRATEGY_COMPLETE bonus below, once all 7 are
  // done. contentUnlockBonusAt/linkedinUnlockBonusAt are still set as
  // "answered, ever" bookkeeping — complete-profile's own standalone
  // ThoughtLeadershipUnlockForm/LinkedInUnlockForm (marketing-plan/actions.ts,
  // linkedin/actions.ts) still independently award MARKETING_PLAN_UNLOCK/
  // LINKEDIN_UNLOCK points if a candidate reaches those forms first, and
  // read these same flags to avoid re-awarding.
  if (!profile.contentUnlockBonusAt) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { contentUnlockBonusAt: new Date() },
    })
  }
  if (!profile.linkedinUnlockBonusAt) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { linkedinUnlockBonusAt: new Date() },
    })
  }

  await maybeAwardSearchStrategyCompleteBonus(profile.id)

  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard/marketing-plan')
  revalidatePath('/dashboard/linkedin')
}

// Optional, best-effort — not part of maybeAwardSearchStrategyCompleteBonus.
// Same underlying write as the Interim Work re-ask (see
// setBoardAdvisoryWillingness); this is just the Search Strategy entry point.
export async function updateBoardAdvisoryWillingness(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const answer = formData.get('answer') as string | null
  if (answer !== 'yes' && answer !== 'no') {
    return { error: 'Please answer yes or no before continuing.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await setBoardAdvisoryWillingness(profile.id, answer === 'yes')

  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard/interim-work')
}

// Consolidates the network comfort gate that used to block My Network
// directly (NetworkComfortCheck) plus the new self-set weekly outreach
// target — same one-time bonus-award pattern as setNetworkComfortLevel in
// network/actions.ts. My Network now reads networkComfortLevel straight off
// the profile rather than rendering its own gate form.
export async function updateNetworkingWillingness(
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

  const networkComfortLevel = (formData.get('networkComfortLevel') as string | null) || null
  const networkingConcerns = formData.getAll('networkingConcerns') as NetworkingAnxiety[]
  const outreachTargetRaw = formData.get('networkingOutreachTargetPerWeek') as string | null
  const networkingOutreachTargetPerWeek = outreachTargetRaw ? Number(outreachTargetRaw) : null
  const hasBeenReferredBefore = formData.get('hasBeenReferredBefore') === 'on'
  const referralRecencyRaw = (formData.get('referralRecency') as string | null) || null
  const referralRecency = hasBeenReferredBefore ? (referralRecencyRaw as ReferralRecency | null) : null

  if (!networkComfortLevel) {
    return { error: 'Please answer how comfortable you are letting your network know.' }
  }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      networkComfortLevel: networkComfortLevel as NetworkComfortLevel,
      networkingConcerns,
      networkingOutreachTargetPerWeek,
      hasBeenReferredBefore,
      referralRecency,
    },
  })

  captureServerEvent(profile.id, 'network_comfort_answered', { comfortLevel: networkComfortLevel })
  captureServerEvent(profile.id, 'network_page_unlocked')

  // No per-field points here anymore (see updateMarketingPlanWillingness
  // above) — networkComfortBonusAt still gets set as bookkeeping;
  // complete-profile's NetworkComfortCheck (network/actions.ts's
  // setNetworkComfortLevel) still independently awards
  // NETWORK_COMFORT_CONFIRMED if reached first, and reads this same flag.
  if (!profile.networkComfortBonusAt) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { networkComfortBonusAt: new Date() },
    })
  }

  await maybeAwardSearchStrategyCompleteBonus(profile.id)

  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard/network')
}

export async function updateNegotiationInterviewComfort(
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

  const negotiationComfortRaw = formData.get('negotiationComfort') as string | null
  const interviewComfortRaw = formData.get('interviewComfort') as string | null
  const negotiationComfort = negotiationComfortRaw ? Number(negotiationComfortRaw) : null
  const interviewComfort = interviewComfortRaw ? Number(interviewComfortRaw) : null

  if (negotiationComfort === null || interviewComfort === null) {
    return { error: 'Please answer both questions.' }
  }

  const wasFirstCompletion = profile.negotiationComfort === null || profile.interviewComfort === null

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { negotiationComfort, interviewComfort },
  })

  captureServerEvent(profile.id, 'negotiation_interview_comfort_answered', {
    negotiationComfort,
    interviewComfort,
  })

  // No per-field points here anymore (see updateMarketingPlanWillingness
  // above) — negotiationInterviewComfortBonusAt still gets set as
  // bookkeeping.
  if (wasFirstCompletion && !profile.negotiationInterviewComfortBonusAt) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { negotiationInterviewComfortBonusAt: new Date() },
    })
  }

  await maybeAwardSearchStrategyCompleteBonus(profile.id)

  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard/interview-prep')
}

// The three combined actions below back the wizard's grouped pages — each
// page shows two independently-meaningful question sets (their own DB
// fields, their own completion/unlock semantics) on one screen with a
// single Save button, per the "no separate saves on one page" fix. Rather
// than duplicating either action's field-parsing/validation logic, these
// just call both real actions in sequence against the same FormData (each
// action only reads the field names it cares about) and stop at the first
// error, so validation messages stay exactly what they were before.

export async function updateMarketingAndNetworkingWillingness(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const marketing = await updateMarketingPlanWillingness(undefined, formData)
  if (marketing?.error) return marketing
  return updateNetworkingWillingness(undefined, formData)
}

export async function updateNegotiationAndCompensationReadiness(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const negotiation = await updateNegotiationInterviewComfort(undefined, formData)
  if (negotiation?.error) return negotiation
  return answerBenefitsPriorities(undefined, formData)
}

export async function updateOtherSearchStrengtheners(_prevState: FormState, formData: FormData): Promise<FormState> {
  const boardAdvisory = await updateBoardAdvisoryWillingness(undefined, formData)
  if (boardAdvisory?.error) return boardAdvisory
  return answerOptionalQuestions(undefined, formData)
}
