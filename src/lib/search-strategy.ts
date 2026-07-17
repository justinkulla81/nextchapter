import type { CurrentJobStatus, GapDurationBucket } from '@prisma/client'

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
