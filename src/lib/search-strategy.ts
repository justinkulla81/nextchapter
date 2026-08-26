import type {
  ChangePacePreference,
  ChangeReadiness,
  CoachingStylePreference,
  CurrentJobStatus,
  GapDurationBucket,
  NetworkComfortLevel,
} from '@prisma/client'

// Search Stage is deliberately not stored — it's derived from data already
// captured during onboarding (currentJobStatus + gapDuration), so it can
// never drift out of sync with those fields.
export type SearchStage = 'QUIETLY_LOOKING' | 'ZERO_TO_THREE' | 'THREE_TO_SIX' | 'SIX_TO_TWELVE' | 'TWELVE_PLUS'

export const SEARCH_STAGE_LABELS: Record<SearchStage, string> = {
  QUIETLY_LOOKING: 'Quietly looking while employed',
  ZERO_TO_THREE: '0–3 months since separation',
  THREE_TO_SIX: '3–6 months since separation',
  SIX_TO_TWELVE: '6–12 months since separation',
  TWELVE_PLUS: '12+ months since separation',
}

// The headline sentence shown at the top of Search Strategy — framed around
// time-since-separation for anyone actually out of work, and around the
// quietly-looking situation for anyone still employed (no "back to work"
// framing there, since they haven't lost their job).
export const SEARCH_STAGE_MESSAGE: Record<SearchStage, string> = {
  QUIETLY_LOOKING:
    "You're quietly looking while still employed. Let's develop a strategy that fits around your current role.",
  ZERO_TO_THREE:
    "It has been less than 3 months since you separated. Let's develop a strategy to get you back to work as quickly as possible.",
  THREE_TO_SIX:
    "It has been 3–6 months since you separated. Let's develop a strategy to get you back to work as quickly as possible.",
  SIX_TO_TWELVE:
    "It has been 6–12 months since you separated. Let's develop a strategy to get you back to work as quickly as possible.",
  TWELVE_PLUS:
    "It has been over 12 months since you separated. Let's develop a strategy to get you back to work as quickly as possible.",
}

const GAP_DURATION_TO_STAGE: Record<GapDurationBucket, SearchStage> = {
  ZERO_TO_THREE_MONTHS: 'ZERO_TO_THREE',
  THREE_TO_SIX_MONTHS: 'THREE_TO_SIX',
  SIX_TO_TWELVE_MONTHS: 'SIX_TO_TWELVE',
  TWELVE_PLUS_MONTHS: 'TWELVE_PLUS',
}

export function getSearchStage(candidate: {
  currentJobStatus: CurrentJobStatus | null
  gapDuration: GapDurationBucket | null
}): SearchStage | null {
  if (candidate.currentJobStatus === 'EMPLOYED_CONSIDERING_MOVE') return 'QUIETLY_LOOKING'
  if (!candidate.gapDuration) return null
  return GAP_DURATION_TO_STAGE[candidate.gapDuration]
}

// The full "Your Search Goals" section (SearchStrategyForm) is considered
// complete once every field that actually drives matching/guidance is set —
// deliberately excludes fields that are genuinely optional or conditional
// (secondaryFunction, applicationVolumeGoal has a 15/week default,
// dealBreakers, relocationNotes, startLowerRationale, targetFunction only
// applies when isPivoting). Gates both Strategy Guidance from Victoria and
// its appearance in the Market Reality Report — job guidance shouldn't be
// drafted off a half-filled form.
export function isSearchGoalsComplete(candidate: {
  targetRoleType: string | null
  primaryFunction: string | null
  targetIndustries: string[]
  targetCompanySize: string | null
  targetCompanyStage: string | null
  remotePreference: string | null
  highestLevelReached: string | null
}): boolean {
  return !!(
    candidate.targetRoleType &&
    candidate.primaryFunction &&
    candidate.targetIndustries.length > 0 &&
    candidate.targetCompanySize &&
    candidate.targetCompanyStage &&
    candidate.remotePreference &&
    candidate.highestLevelReached
  )
}

// The "Blockers and Motivations" section on Search Strategy — a second,
// independent required bucket (alongside isSearchGoalsComplete above)
// before Victoria will draft Search Strategy guidance. Deliberately
// excludes the genuinely optional fields in that section
// (consistencySelfRating, blockersOpenText, motivationsElaboration) — see
// PersonalContextForm.
export function isBlockersAndMotivationsComplete(candidate: {
  blockers: string[]
  motivations: string[]
  coachingStylePreference: CoachingStylePreference | null
  changePacePreference: ChangePacePreference | null
  changeReadiness: ChangeReadiness | null
}): boolean {
  return !!(
    candidate.blockers.length > 0 &&
    candidate.motivations.length > 0 &&
    candidate.coachingStylePreference &&
    candidate.changePacePreference &&
    candidate.changeReadiness
  )
}

// The "Marketing Plan Willingness" section on Search Strategy — consolidates
// the two unlock gates that used to live directly on My Marketing Plan
// (contentComfortLevel/contentVenues) and LinkedIn (linkedinOpennessComfort/
// linkedinUsageFrequency/linkedinProfileUpToDate), so a candidate answers
// "what am I willing to do publicly" once, up front, instead of hitting two
// separate locked pages later. Not one of the two required-for-Victoria
// gates (isSearchGoalsComplete/isBlockersAndMotivationsComplete) — this is
// informational/unlocking, not a scoring input.
export function isMarketingPlanWillingnessComplete(candidate: {
  publicDisclosureComfort: string | null
  contentComfortLevel: number | null
  contentVenues: string[]
  linkedinOpennessComfort: number | null
  linkedinUsageFrequency: string | null
  linkedinProfileUpToDate: boolean | null
}): boolean {
  return !!(
    candidate.publicDisclosureComfort &&
    candidate.contentComfortLevel !== null &&
    candidate.contentVenues.length > 0 &&
    candidate.linkedinOpennessComfort !== null &&
    candidate.linkedinUsageFrequency &&
    candidate.linkedinProfileUpToDate !== null
  )
}

// The "Networking Willingness" section on Search Strategy — consolidates
// the network comfort gate that used to block My Network directly
// (networkComfortLevel) plus the new self-set weekly outreach target. Same
// non-required, unlocking-not-scoring status as
// isMarketingPlanWillingnessComplete above. networkingConcerns and
// hasBeenReferredBefore/referralRecency are deliberately excluded — genuinely
// optional context, not gating fields, same as the optional fields excluded
// from isBlockersAndMotivationsComplete above.
export function isNetworkingWillingnessComplete(candidate: {
  networkComfortLevel: NetworkComfortLevel | null
  networkingOutreachTargetPerWeek: number | null
}): boolean {
  return !!(candidate.networkComfortLevel && candidate.networkingOutreachTargetPerWeek !== null)
}

// "Board Advisory Work" willingness question — a single yes/no, answerable
// here or re-asked at the top of Interim Work (see
// setBoardAdvisoryWillingness). Deliberately not folded into
// isSearchStrategyWizardComplete or isSearchStrategyGateComplete — this is
// optional/best-effort, not a required gate or a SEARCH_STRATEGY_COMPLETE
// bonus input.
export function isBoardAdvisoryWillingnessComplete(candidate: { boardAdvisoryWillingness: boolean | null }): boolean {
  return candidate.boardAdvisoryWillingness !== null
}

// "Negotiation & Interview Comfort" section — re-surfaces interviewComfort
// (already asked in Interview Prep's Comfort Check) alongside the new
// negotiationComfort question, in one place, so a low score on either can
// feed skill-gap-suggestions.ts and the Videos page's GENERAL-video
// matching without requiring a trip through Interview Prep first. Same
// non-required, unlocking-not-scoring status as the Willingness sections above.
export function isNegotiationInterviewComfortComplete(candidate: {
  negotiationComfort: number | null
  interviewComfort: number | null
}): boolean {
  return candidate.negotiationComfort !== null && candidate.interviewComfort !== null
}

// "Your Search Strategy So Far" section — the 5-field optional-questions
// bundle (OptionalQuestionsForm). Mirrors the exact fields answerOptionalQuestions
// requires answered.
export function isSearchStrategySoFarComplete(candidate: {
  networkingLevel: number | null
  learnedNewSkillsLevel: number | null
  triedPartTimeOrConsulting: boolean | null
  triedExecutiveCoaching: boolean | null
  connectedWithRecruiters: boolean | null
}): boolean {
  return [
    candidate.networkingLevel,
    candidate.learnedNewSkillsLevel,
    candidate.triedPartTimeOrConsulting,
    candidate.triedExecutiveCoaching,
    candidate.connectedWithRecruiters,
  ].every((f) => f !== null)
}

// "Compensation & Benefits" section — benefitsPrioritiesBonusAt is set the
// first time answerBenefitsPriorities saves (see complete-profile/actions.ts),
// regardless of whether it still also awards its own points.
export function isBenefitsComplete(candidate: { benefitsPrioritiesBonusAt: Date | null }): boolean {
  return !!candidate.benefitsPrioritiesBonusAt
}

// All 7 Search Strategy wizard pages — used both to gate
// SEARCH_STRATEGY_COMPLETE (see maybeAwardSearchStrategyCompleteBonus in
// search-strategy-complete.ts) and to drive the wizard's own step-complete
// checkmarks.
export function isSearchStrategyWizardComplete(
  candidate: Parameters<typeof isSearchGoalsComplete>[0] &
    Parameters<typeof isBlockersAndMotivationsComplete>[0] &
    Parameters<typeof isMarketingPlanWillingnessComplete>[0] &
    Parameters<typeof isNetworkingWillingnessComplete>[0] &
    Parameters<typeof isNegotiationInterviewComfortComplete>[0] &
    Parameters<typeof isSearchStrategySoFarComplete>[0] &
    Parameters<typeof isBenefitsComplete>[0]
): boolean {
  return (
    isSearchStrategySoFarComplete(candidate) &&
    isSearchGoalsComplete(candidate) &&
    isBlockersAndMotivationsComplete(candidate) &&
    isMarketingPlanWillingnessComplete(candidate) &&
    isNetworkingWillingnessComplete(candidate) &&
    isNegotiationInterviewComfortComplete(candidate) &&
    isBenefitsComplete(candidate)
  )
}
