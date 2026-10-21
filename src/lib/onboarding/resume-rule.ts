// Whether the résumé step can be skipped in the onboarding bundles. Pure and client-safe.
//
// Required (no skip): people out of work and looking, and anyone who arrived through a Market Reality
// link. Their Market Reality is the point of coming, and it cannot be worked out without a résumé.
// Optional for everyone else (considering a move, a promotion, a career change, taking a break, fractional
// work, building something): they can skip, and are asked on login instead (see ResumePromptNote).
//
// "Out of work and looking" is read from the journey definitions (employed: false and searching: true), so a
// new journey is placed by its own flags and nothing here needs editing.

import { getJourney, type JourneyType } from '@/lib/journey/journey'

/** Stored in journeyDetails.entry by the first bundle when the visitor came through a Market Reality link. */
export const ENTRY_KEY = 'entry'
export const MARKET_REALITY_ENTRY = 'market_reality'
/** The query string on a Market Reality link: /onboarding/desire?goal=market-reality */
export const MARKET_REALITY_GOAL_PARAM = 'goal'
export const MARKET_REALITY_GOAL_VALUE = 'market-reality'

export function entryFromGoalParam(goal: string | null | undefined): typeof MARKET_REALITY_ENTRY | null {
  return goal === MARKET_REALITY_GOAL_VALUE ? MARKET_REALITY_ENTRY : null
}

export function entryOf(journeyDetails: unknown): typeof MARKET_REALITY_ENTRY | null {
  return (journeyDetails as Record<string, unknown> | null)?.[ENTRY_KEY] === MARKET_REALITY_ENTRY ? MARKET_REALITY_ENTRY : null
}

export function resumeRequired(input: { journey: JourneyType | null; entry?: unknown }): boolean {
  if (input.entry === MARKET_REALITY_ENTRY) return true
  // No journey yet cannot happen on this step; if it ever does, keep the original rule: required.
  if (!input.journey) return true
  const journey = getJourney(input.journey)
  return !journey.employed && journey.searching
}
