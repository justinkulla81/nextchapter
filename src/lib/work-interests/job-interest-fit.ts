// Work Interests -> job fit. A job's function maps to the Holland RIASEC
// areas that kind of work usually draws on; a member whose top areas
// (from the O*NET Interest Profiler) include one gets a small bonus.
// Deliberately a nudge, never a gate or a penalty: it can lift a job within
// the fit score's existing caps and never pushes one down, so members who
// skipped the assessment score exactly as before.

import type { InterestArea } from '@/lib/work-interests/areas'

// Keyed by lowercased function name (PRIMARY_FUNCTION_OPTIONS). 'general' and
// 'other' say nothing about the kind of work, so they're absent.
const FUNCTION_INTEREST_AREAS: Record<string, InterestArea[]> = {
  operations: ['CONVENTIONAL', 'ENTERPRISING'],
  marketing: ['ARTISTIC', 'ENTERPRISING'],
  finance: ['CONVENTIONAL', 'ENTERPRISING'],
  sales: ['ENTERPRISING', 'SOCIAL'],
  engineering: ['INVESTIGATIVE', 'REALISTIC'],
  product: ['INVESTIGATIVE', 'ENTERPRISING'],
  design: ['ARTISTIC', 'INVESTIGATIVE'],
  'human resources': ['SOCIAL', 'ENTERPRISING'],
  administration: ['CONVENTIONAL', 'SOCIAL'],
  legal: ['ENTERPRISING', 'INVESTIGATIVE'],
  'customer success': ['SOCIAL', 'ENTERPRISING'],
  'data & analytics': ['INVESTIGATIVE', 'CONVENTIONAL'],
  'executive leadership': ['ENTERPRISING', 'SOCIAL'],
}

// Points when the job's areas include the member's #1 / #2-3 area.
export const TOP_INTEREST_POINTS = 6
export const OTHER_TOP_INTEREST_POINTS = 3

/**
 * @param topAreas the member's top three areas, highest first (may be empty)
 * @param jobFunctions the job's functions, lowercased
 */
export function interestBonus(topAreas: readonly string[], jobFunctions: readonly string[]): number {
  if (topAreas.length === 0 || jobFunctions.length === 0) return 0
  let best = 0
  for (const fn of jobFunctions) {
    const areas = FUNCTION_INTEREST_AREAS[fn]
    if (!areas) continue
    for (const area of areas) {
      const rank = topAreas.indexOf(area)
      if (rank === 0) return TOP_INTEREST_POINTS
      if (rank > 0) best = OTHER_TOP_INTEREST_POINTS
    }
  }
  return best
}
