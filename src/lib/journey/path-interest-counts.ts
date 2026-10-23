// Aggregate counts of what members are thinking about, per path and level, for partnership conversations. Counts only:
// a cell under the floor is withheld (null), no row, id or name ever leaves this function, and nothing here is sent to an
// outside party. Only members' own stated levels (journeyDetails.paths.<key>.level) are counted, never what we derived.
// Pure.

import { INTEREST_KEYS, INTEREST_LEVELS, statedLevelsOf, type InterestKey, type InterestLevel } from './paths'

/** The smallest cohort a count may show. */
export const PARTNERSHIP_MIN_COHORT = 10

export type PathInterestCounts = Record<InterestKey, Record<InterestLevel, number | null>>

export function pathInterestCounts(allJourneyDetails: readonly unknown[], min: number = PARTNERSHIP_MIN_COHORT): PathInterestCounts {
  const raw = Object.fromEntries(INTEREST_KEYS.map((k) => [k, Object.fromEntries(INTEREST_LEVELS.map((l) => [l.value, 0]))])) as Record<InterestKey, Record<InterestLevel, number>>
  for (const d of allJourneyDetails) {
    const stated = statedLevelsOf(d)
    for (const k of INTEREST_KEYS) {
      const l = stated[k]
      if (l) raw[k][l] += 1
    }
  }
  return Object.fromEntries(
    INTEREST_KEYS.map((k) => [k, Object.fromEntries(INTEREST_LEVELS.map((l) => [l.value, raw[k][l.value] >= min ? raw[k][l.value] : null]))]),
  ) as PathInterestCounts
}
