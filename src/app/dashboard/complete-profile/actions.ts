'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { captureServerEvent } from '@/lib/posthog/server'
import { LICENSE_KEYS } from '@/lib/jobs/requirements'
import { maybeAwardSearchStrategyCompleteBonus } from '@/lib/weekly/search-strategy-complete'
import {
  hasAnyIndependentWork,
  isIndependentWorkAnswered,
  parseIndependentWorkExperience,
} from '@/lib/independent-work/experience'
import { captureMatchBaseline } from '@/lib/personalization/match-snapshot'

export type OptionalQuestionsState = { error?: string } | undefined

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

// 5 optional job-search-activity fields first asked in onboarding
// (CircumstancesForm) — until now they had no way to be answered
// afterward if skipped, even though ANSWER_OPTIONAL_QUESTIONS has always
// been a real one-time Search Action. This is that missing form's action,
// mirroring updateCircumstances's parsing for the same fields exactly.
// jobsAppliedBucket/interviewsReceivedCount used to live here too, but
// they're now asked (as exact numbers) during onboarding's search-status
// screen instead — see updateLocationAndSearchStatus — so they were
// dropped from this form to stop asking the candidate twice.
export async function answerOptionalQuestions(
  _prevState: OptionalQuestionsState,
  formData: FormData
): Promise<OptionalQuestionsState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }
  const candidateId = profile.id

  const networkingLevelRaw = formData.get('networkingLevel')
  const networkingLevel = networkingLevelRaw ? Number(networkingLevelRaw) : null
  const learnedNewSkillsLevelRaw = formData.get('learnedNewSkillsLevel')
  const learnedNewSkillsLevel = learnedNewSkillsLevelRaw ? Number(learnedNewSkillsLevelRaw) : null
  // The per-type answer replaces the old single yes/no; the old boolean is
  // derived from it so the checklist and sprint scoring keep working.
  const independentWorkExperience = parseIndependentWorkExperience({
    consulting: formData.get('independentWork_consulting'),
    expert_network: formData.get('independentWork_expert_network'),
    fractional: formData.get('independentWork_fractional'),
    part_time: formData.get('independentWork_part_time'),
  })
  const independentWorkAnswered = isIndependentWorkAnswered(independentWorkExperience)
  const triedPartTimeOrConsulting = independentWorkAnswered ? hasAnyIndependentWork(independentWorkExperience) : null
  const triedExecutiveCoachingRaw = formData.get('triedExecutiveCoaching') as string | null
  const triedExecutiveCoaching =
    triedExecutiveCoachingRaw === 'yes' ? true : triedExecutiveCoachingRaw === 'no' ? false : null
  const connectedWithRecruitersRaw = formData.get('connectedWithRecruiters') as string | null
  const connectedWithRecruiters =
    connectedWithRecruitersRaw === 'yes' ? true : connectedWithRecruitersRaw === 'no' ? false : null
  const recruiterConnectionCountRaw = formData.get('recruiterConnectionCount')
  const recruiterConnectionCount =
    connectedWithRecruiters && recruiterConnectionCountRaw ? Number(recruiterConnectionCountRaw) : null

  const allAnswered = [
    networkingLevel,
    learnedNewSkillsLevel,
    triedPartTimeOrConsulting,
    triedExecutiveCoaching,
    connectedWithRecruiters,
  ].every((f) => f !== null)
  if (!allAnswered) {
    return { error: 'Please answer every question — they only take a minute.' }
  }

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      networkingLevel,
      learnedNewSkillsLevel,
      triedPartTimeOrConsulting,
      independentWorkExperience,
      triedExecutiveCoaching,
      connectedWithRecruiters,
      recruiterConnectionCount,
    },
  })

  captureServerEvent(candidateId, 'independent_work_experience_answered', {
    candidateId,
    ...independentWorkExperience,
    prefilledTypes: formData.getAll('independentWork_prefilled').map(String),
    source: 'search_strategy',
  })

  await maybeAwardSearchStrategyCompleteBonus(candidateId)

  revalidatePath('/dashboard/complete-profile')
  revalidatePath('/dashboard')
}

export type RedFlagsState = { error?: string } | undefined

function parseYesNo(raw: FormDataEntryValue | null): boolean | null {
  return raw === 'yes' ? true : raw === 'no' ? false : null
}

const CLEARANCE_VALUES = new Set(['none', 'public_trust', 'secret', 'top_secret', 'ts_sci'])
const POLYGRAPH_VALUES = new Set(['none', 'ci', 'full_scope'])

/** Clearance held, or null when the question was left blank. "None" clears status and polygraph. */
function parseClearanceAnswers(formData: FormData) {
  const level = (formData.get('clearanceLevel') as string | null) || ''
  if (!CLEARANCE_VALUES.has(level)) return null
  if (level === 'none') return { clearanceLevel: 'none', clearanceActive: null, clearancePolygraph: null }
  const status = formData.get('clearanceStatus')
  const poly = (formData.get('clearancePolygraph') as string | null) || ''
  return {
    clearanceLevel: level,
    clearanceActive: status === 'active' ? true : status === 'lapsed' ? false : null,
    clearancePolygraph: POLYGRAPH_VALUES.has(poly) ? poly : null,
  }
}

/** Licenses held (known keys only, sorted), or null when the question was left blank. */
function parseLicenseAnswers(formData: FormData): string[] | null {
  if (formData.get('licensesAnswered') !== '1') return null
  const held = new Set(formData.getAll('licensesHeld').map(String))
  return LICENSE_KEYS.filter((k) => held.has(k)).sort()
}

// Real screening/deal-breaker questions recruiters/hiring managers ask
// before an offer — drug test, background check, restrictive covenant (the
// third already had schema fields from Coaching Notes' Red Lines but no UI
// or action anywhere), and animal-friendly workplace (a candidate-side deal
// breaker, not an employer screen, but grouped here per the same "red
// line" framing). Bundled into one RED_FLAGS_CONFIRMED bonus, same "small
// related-question bundle, one flat point value" shape as
// answerOptionalQuestions above and ComfortCheckTab's COMFORT_CHECK_CONFIRM.
export async function answerRedFlags(_prevState: RedFlagsState, formData: FormData): Promise<RedFlagsState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const willingToTakeDrugTest = parseYesNo(formData.get('willingToTakeDrugTest'))
  const willingToTakeBackgroundCheck = parseYesNo(formData.get('willingToTakeBackgroundCheck'))
  const hasRestrictiveCovenant = parseYesNo(formData.get('hasRestrictiveCovenant'))
  // Only asked (and only required) when currentJobStatus is LAID_OFF — see
  // RedFlagsQuestionsForm's askFiredForCause gate.
  const askFiredForCause = profile.currentJobStatus === 'LAID_OFF'
  const firedForCause = askFiredForCause ? parseYesNo(formData.get('firedForCause')) : null

  if (
    [willingToTakeDrugTest, willingToTakeBackgroundCheck, hasRestrictiveCovenant].some(
      (f) => f === null
    ) ||
    (askFiredForCause && firedForCause === null)
  ) {
    return { error: 'Please answer every question — they only take a minute.' }
  }

  const restrictiveCovenantDetails = hasRestrictiveCovenant
    ? (formData.get('restrictiveCovenantDetails') as string) || null
    : null

  // Optional clearance and licenses (matched against job requirements, requirements.ts).
  // Left blank, they stay as they were — never cleared by a save of the other questions.
  const clearance = parseClearanceAnswers(formData)
  const licenses = parseLicenseAnswers(formData)
  if (clearance || licenses) await captureMatchBaseline(profile)

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      willingToTakeDrugTest,
      willingToTakeBackgroundCheck,
      hasRestrictiveCovenant,
      restrictiveCovenantDetails,
      ...(askFiredForCause && { firedForCause }),
      ...(clearance ?? {}),
      ...(licenses ? { licensesHeld: licenses, licensesAnsweredAt: new Date() } : {}),
      // Answering clears the "From your résumé — confirm" mark (resume-prefill.ts).
      ...((clearance || licenses) && {
        resumePrefilledFields: profile.resumePrefilledFields.filter(
          (f) => !(clearance && f === 'clearanceLevel') && !(licenses && f === 'licensesHeld')
        ),
      }),
    },
  })
  if (clearance && (clearance.clearanceLevel !== profile.clearanceLevel || clearance.clearanceActive !== profile.clearanceActive || clearance.clearancePolygraph !== profile.clearancePolygraph)) {
    captureServerEvent(profile.id, 'requirement_profile_answered', { field: 'clearance', surface: 'screening', level: clearance.clearanceLevel })
  }
  if (licenses && (profile.licensesAnsweredAt === null || licenses.join() !== [...profile.licensesHeld].sort().join())) {
    captureServerEvent(profile.id, 'requirement_profile_answered', { field: 'licenses', surface: 'screening', count: licenses.length })
  }

  captureServerEvent(profile.id, 'red_flags_answered', {
    willingToTakeDrugTest,
    willingToTakeBackgroundCheck,
    hasRestrictiveCovenant,
    firedForCause,
  })

  // One-time points award, unconditional on the sprint-exists check below —
  // see setNetworkComfortLevel's comment in network/actions.ts for why "did
  // you answer this, ever" must never depend on a current-week sprint
  // happening to already exist.
  if (!profile.redFlagsBonusAt) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { redFlagsBonusAt: new Date() },
    })
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'RED_FLAGS_CONFIRMED' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'RED_FLAGS_CONFIRMED',
        text: 'Complete Screening Questions',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
  }

  revalidatePath('/dashboard/complete-profile')
  revalidatePath('/dashboard')
}

export type BenefitsPrioritiesState = { error?: string } | undefined

// Same "in thousands" input/correction convention as updateSearchStrategy's
// targetCompMinThousands parsing (search-strategy/actions.ts) — this field
// moved here from Search Strategy, the parsing logic moved with it.
function parseCompMinThousands(raw: FormDataEntryValue | null): number | null {
  const entered = raw ? Number(raw) : null
  if (entered === null) return null
  return entered >= 10000 ? Math.round(entered / 1000) : entered
}

// Benefits & compensation priorities — minimum comp (moved off Search
// Strategy) plus real benefit-importance/expectation questions recruiters
// and hiring managers ask about. Bundled into one
// BENEFITS_PRIORITIES_CONFIRMED bonus, same shape as RED_FLAGS_CONFIRMED
// above. Every field here is optional content-wise (a candidate can
// legitimately have no preference), but the bonus still requires an
// explicit answer to every yes/no question — same "answering counts, not
// the answer given" reasoning as LINKEDIN_PROFILE_ADDED's noLinkedIn case.
export async function answerBenefitsPriorities(
  _prevState: BenefitsPrioritiesState,
  formData: FormData
): Promise<BenefitsPrioritiesState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const wantsHealthDentalVisionInsurance = parseYesNo(formData.get('wantsHealthDentalVisionInsurance'))
  const wantsDisabilityInsurance = parseYesNo(formData.get('wantsDisabilityInsurance'))
  const wants401kMatch = parseYesNo(formData.get('wants401kMatch'))
  const wantsProfessionalDevReimbursement = parseYesNo(formData.get('wantsProfessionalDevReimbursement'))
  const wantsCommuterBenefits = parseYesNo(formData.get('wantsCommuterBenefits'))
  const wantsGymMembership = parseYesNo(formData.get('wantsGymMembership'))

  if (
    [
      wantsHealthDentalVisionInsurance,
      wantsDisabilityInsurance,
      wants401kMatch,
      wantsProfessionalDevReimbursement,
      wantsCommuterBenefits,
      wantsGymMembership,
    ].some((f) => f === null)
  ) {
    return { error: 'Please answer every question — they only take a minute.' }
  }

  const targetCompMinThousands = parseCompMinThousands(formData.get('targetCompMinThousands'))
  const ptoWeeksExpectedRaw = formData.get('ptoWeeksExpected')
  const remoteDaysPerWeekDesiredRaw = formData.get('remoteDaysPerWeekDesired')
  const paidParentalLeaveWeeksExpectedRaw = formData.get('paidParentalLeaveWeeksExpected')

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      targetCompMin: targetCompMinThousands ? targetCompMinThousands * 1000 : null,
      wantsHealthDentalVisionInsurance,
      wantsDisabilityInsurance,
      wants401kMatch,
      ptoWeeksExpected: ptoWeeksExpectedRaw ? Number(ptoWeeksExpectedRaw) : null,
      remoteDaysPerWeekDesired: remoteDaysPerWeekDesiredRaw ? Number(remoteDaysPerWeekDesiredRaw) : null,
      paidParentalLeaveWeeksExpected: paidParentalLeaveWeeksExpectedRaw
        ? Number(paidParentalLeaveWeeksExpectedRaw)
        : null,
      wantsProfessionalDevReimbursement,
      wantsCommuterBenefits,
      wantsGymMembership,
    },
  })

  captureServerEvent(profile.id, 'benefits_priorities_answered', {
    wantsHealthDentalVisionInsurance,
    wantsDisabilityInsurance,
    wants401kMatch,
    wantsProfessionalDevReimbursement,
    wantsCommuterBenefits,
    wantsGymMembership,
  })

  // No standalone points here anymore — this form only ever renders on
  // Search Strategy, which awards SEARCH_STRATEGY_COMPLETE once all 7
  // pages are done instead. benefitsPrioritiesBonusAt is still set as
  // "answered, ever" bookkeeping (see isBenefitsComplete).
  if (!profile.benefitsPrioritiesBonusAt) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { benefitsPrioritiesBonusAt: new Date() },
    })
  }

  await maybeAwardSearchStrategyCompleteBonus(profile.id)

  revalidatePath('/dashboard/complete-profile')
  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard')
}
