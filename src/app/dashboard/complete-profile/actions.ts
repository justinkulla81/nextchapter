'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { captureServerEvent } from '@/lib/posthog/server'

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
  const triedPartTimeOrConsultingRaw = formData.get('triedPartTimeOrConsulting') as string | null
  const triedPartTimeOrConsulting =
    triedPartTimeOrConsultingRaw === 'yes' ? true : triedPartTimeOrConsultingRaw === 'no' ? false : null
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
      triedExecutiveCoaching,
      connectedWithRecruiters,
      recruiterConnectionCount,
    },
  })

  revalidatePath('/dashboard/complete-profile')
  revalidatePath('/dashboard')
}

export type RedFlagsState = { error?: string } | undefined

function parseYesNo(raw: FormDataEntryValue | null): boolean | null {
  return raw === 'yes' ? true : raw === 'no' ? false : null
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
  const wantsAnimalFriendlyWorkplace = parseYesNo(formData.get('wantsAnimalFriendlyWorkplace'))
  // Only asked (and only required) when currentJobStatus is LAID_OFF — see
  // RedFlagsQuestionsForm's askFiredForCause gate.
  const askFiredForCause = profile.currentJobStatus === 'LAID_OFF'
  const firedForCause = askFiredForCause ? parseYesNo(formData.get('firedForCause')) : null

  if (
    [willingToTakeDrugTest, willingToTakeBackgroundCheck, hasRestrictiveCovenant, wantsAnimalFriendlyWorkplace].some(
      (f) => f === null
    ) ||
    (askFiredForCause && firedForCause === null)
  ) {
    return { error: 'Please answer every question — they only take a minute.' }
  }

  const restrictiveCovenantDetails = hasRestrictiveCovenant
    ? (formData.get('restrictiveCovenantDetails') as string) || null
    : null

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      willingToTakeDrugTest,
      willingToTakeBackgroundCheck,
      hasRestrictiveCovenant,
      restrictiveCovenantDetails,
      wantsAnimalFriendlyWorkplace,
      ...(askFiredForCause && { firedForCause }),
    },
  })

  captureServerEvent(profile.id, 'red_flags_answered', {
    willingToTakeDrugTest,
    willingToTakeBackgroundCheck,
    hasRestrictiveCovenant,
    wantsAnimalFriendlyWorkplace,
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

  if (!profile.benefitsPrioritiesBonusAt) {
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { benefitsPrioritiesBonusAt: new Date() },
    })
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'BENEFITS_PRIORITIES_CONFIRMED' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'BENEFITS_PRIORITIES_CONFIRMED',
        text: 'Answer your benefits & compensation priorities',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
  }

  revalidatePath('/dashboard/complete-profile')
  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard')
}
