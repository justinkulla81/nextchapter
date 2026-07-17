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
