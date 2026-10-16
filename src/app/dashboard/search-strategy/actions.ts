'use server'

import { revalidatePath } from 'next/cache'
import {
  normalizeCompanySizeValue,
  normalizeCompanyStageValue,
  normalizeFunctionValue,
  normalizeLevelValue,
  normalizeRemotePreferenceValue,
} from '@/lib/constants/candidate-profile-normalize'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { PRIMARY_FUNCTION_OPTIONS, TRADEOFF_PRIORITIES } from '@/lib/constants/onboarding'
import { recomputeCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import { maybeAwardSearchStrategyCompleteBonus } from '@/lib/weekly/search-strategy-complete'
import { setBoardAdvisoryWillingness } from '@/lib/search-strategy/board-advisory-willingness'
import { answerBenefitsPriorities, answerOptionalQuestions } from '@/app/dashboard/complete-profile/actions'
import { buildRelocation, opensToMove } from '@/lib/journey/relocation'
import { buildTarget, isCommitted, pivotOf, primaryPivot } from '@/lib/journey/pivot'
import { applyJourneyChange } from '@/lib/journey/apply'
import { effectiveJourney, effectiveStage, getJourney } from '@/lib/journey/journey'
import { Prisma } from '@prisma/client'
import { DIMENSIONS, cleanCultureFit } from '@/lib/culture/culture-fit'
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
  // Option-list values are normalised on write ('DIRECTOR' -> 'Director') — see candidate-profile-normalize.ts.
  const primaryFunction = normalizeFunctionValue(formData.get('primaryFunction') as string | null)
  const secondaryFunctionRaw = (formData.get('secondaryFunction') as string | null) || null
  const secondaryFunction = secondaryFunctionRaw === 'none' ? null : normalizeFunctionValue(secondaryFunctionRaw)
  const gapDurationRaw = (formData.get('gapDuration') as string | null) || null
  const gapDuration = gapDurationRaw === 'none' ? null : (gapDurationRaw as GapDurationBucket | null)
  const highestLevelReachedRaw = (formData.get('highestLevelReached') as string | null) || null
  const highestLevelReached = highestLevelReachedRaw === 'none' ? null : normalizeLevelValue(highestLevelReachedRaw)
  const targetCompanySize = normalizeCompanySizeValue(formData.get('targetCompanySize') as string | null)
  const targetCompanyStage = normalizeCompanyStageValue(formData.get('targetCompanyStage') as string | null)
  const remotePreference = normalizeRemotePreferenceValue(formData.get('remotePreference') as string | null)
  const applicationVolumeGoalRaw = formData.get('applicationVolumeGoal') as string | null
  const applicationVolumeGoal = applicationVolumeGoalRaw ? Number(applicationVolumeGoalRaw) : null
  const willingToFollowUpOnApplications = formData.get('willingToFollowUpOnApplications') === 'on'
  const targetCompMinThousands = parseCompMinThousands(formData.get('targetCompMinThousands'))
  const targetCompMin = targetCompMinThousands ? targetCompMinThousands * 1000 : null
  // How far they will go (src/lib/journey/relocation.ts). The yes/no stays in step for readers that only know it.
  const relocation = buildRelocation({
    scope: formData.get('relocationScope') as string | null,
    radiusMiles: Number(formData.get('relocationRadius')) || null,
    states: formData.getAll('relocationStates').map(String),
  })
  const openToRelocation = opensToMove(relocation)
  const relocationNotes = openToRelocation ? (formData.get('relocationNotes') as string | null)?.trim() || null : null

  // Openness to other fields, with the sanity check and any commitment (src/lib/journey/pivot.ts).
  const now = new Date()
  const current = await prisma.candidateProfile.findUnique({ where: { id: profile.id }, select: { journeyDetails: true, levelRankScore: true, journey: true, journeyStage: true, currentJobStatus: true } })
  const fromFunction = primaryFunction ?? profile.primaryFunction
  const previous = pivotOf(current?.journeyDetails)
  let pivotInput: { function: string; route?: string | null; hoursPerWeek?: number | null; commit?: boolean; how?: string | null }[] = []
  try {
    const parsed = JSON.parse(String(formData.get('pivotJson') ?? '[]'))
    if (Array.isArray(parsed)) pivotInput = parsed.filter((x) => x && typeof x.function === 'string' && (PRIMARY_FUNCTION_OPTIONS as readonly string[]).includes(x.function))
  } catch {
    pivotInput = []
  }
  const targets = pivotInput.map((x) => {
    const built = buildTarget(fromFunction, x.function, x, now, (current?.levelRankScore ?? 0) >= 60)
    // Keep the original commit date when nothing about the commitment changed.
    const before = previous?.targets.find((t) => t.function === x.function)
    return before?.committedAt && built.committedAt && before.route === built.route && before.hoursPerWeek === built.hoursPerWeek ? { ...built, committedAt: before.committedAt } : built
  })
  const pivot = { targets, updatedAt: now.toISOString() }
  const main = primaryPivot(pivot)
  // Only touch the pivot fields when this form says something about them: openness was chosen now or
  // before. A target set elsewhere (Pivot paths) or by the Changing careers journey is left alone.
  const touchPivot = formData.has('pivotJson') && (targets.length > 0 || (previous?.targets.length ?? 0) > 0)
  const isPivoting = !!main
  const targetFunction = main?.function ?? null
  const journeyDetails = { ...((current?.journeyDetails as Record<string, unknown> | null) ?? {}), relocation, pivot } as Prisma.InputJsonValue
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
      ...(touchPivot && { targetFunction }),
      journeyDetails,
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
      ...(touchPivot && { isPivoting }),
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

  captureServerEvent(profile.id, 'search_strategy_updated', {
    relocationScope: relocation.scope,
    relocationStates: relocation.states ?? [],
    openFunctions: targets.map((t) => t.function),
    committedFunctions: targets.filter(isCommitted).map((t) => t.function),
  })
  for (const t of targets.filter(isCommitted)) {
    if (!previous?.targets.some((x) => x.function === t.function && x.committedAt)) {
      captureServerEvent(profile.id, 'pivot_committed', { from: fromFunction, to: t.function, tier: t.tier, route: t.route, hoursPerWeek: t.hoursPerWeek })
    }
  }

  // They made changing careers the main goal: switch the journey, keep the stage and everything they did.
  const wantsSwitch = formData.get('makeCareerChange') === 'on'
  const currentJourney = current ? effectiveJourney(current) : null
  if (wantsSwitch && targets.some(isCommitted) && currentJourney && currentJourney !== 'CAREER_CHANGE' && getJourney(currentJourney).searching) {
    await applyJourneyChange(profile.id, { journey: 'CAREER_CHANGE', stage: effectiveStage(current!) ?? undefined, source: 'SETTINGS', note: 'Committed to a change of function' })
  }

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

// Company culture and working environment: how much it matters, and, only if
// it does, what they want (src/lib/culture/culture-fit.ts). "Not important"
// clears the details so nothing about culture is added to their plan.
export async function saveCultureFit(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Your session ended. Sign in again, and your answers will still be here.' }
  const profile = await getOrCreateCandidateProfile(user.id)

  const importance = formData.get('cultureImportance') as string | null
  if (!importance) return { error: 'Choose how much culture and working environment matter to you.' }
  const fit = cleanCultureFit({
    importance,
    answers: Object.fromEntries(DIMENSIONS.map((d) => [d.key, formData.get(`culture_${d.key}`) as string | null])),
    mustHave: formData.get('cultureMustHave') as string | null,
    dealBreaker: formData.get('cultureDealBreaker') as string | null,
  })
  if (!fit) return { error: 'Choose one of the three options.' }

  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { cultureFit: fit as unknown as Prisma.InputJsonValue } })
  captureServerEvent(profile.id, 'culture_fit_saved', {
    importance: fit.importance,
    dimensionsAnswered: Object.keys(fit.answers).length,
    hasMustHave: fit.mustHave !== null,
    hasDealBreaker: fit.dealBreaker !== null,
  })
  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard')
}
