import type { ChangePacePreference, ChangeReadiness, CoachingStylePreference, CurrentJobStatus, GapDurationBucket } from '@prisma/client'

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
