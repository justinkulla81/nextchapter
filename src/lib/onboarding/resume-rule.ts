// The résumé step of the onboarding bundles, and the Market Reality marker. Pure and client-safe.
//
// The résumé is never required to make an account. Anyone may skip it, and is then asked for their name, email and
// (optionally) LinkedIn on the details step instead (src/lib/onboarding/details.ts). A résumé is what makes the Market
// Reality sharpest, so the screen says so for people who arrived through a Market Reality link, but it does not block them.

/** Stored in journeyDetails.entry by the first bundle when the visitor came through a Market Reality link. */
export const ENTRY_KEY = 'entry'
export const MARKET_REALITY_ENTRY = 'market_reality'
/** The query string on a Market Reality link: /onboarding/desire?goal=market-reality */
export const MARKET_REALITY_GOAL_PARAM = 'goal'
export const MARKET_REALITY_GOAL_VALUE = 'market-reality'
/** Where every "Get your Market Reality Assessment" button goes. */
export const MARKET_REALITY_START_HREF = `/onboarding/desire?${MARKET_REALITY_GOAL_PARAM}=${MARKET_REALITY_GOAL_VALUE}`

export function entryFromGoalParam(goal: string | null | undefined): typeof MARKET_REALITY_ENTRY | null {
  return goal === MARKET_REALITY_GOAL_VALUE ? MARKET_REALITY_ENTRY : null
}

export function entryOf(journeyDetails: unknown): typeof MARKET_REALITY_ENTRY | null {
  return (journeyDetails as Record<string, unknown> | null)?.[ENTRY_KEY] === MARKET_REALITY_ENTRY ? MARKET_REALITY_ENTRY : null
}
