import { decideHomeVariant, type HomeVariant, type HomeVariantDecision } from '@/lib/home-ab'

// Test on https://launchyournextchapter.com/after-a-layoff: version A leads with the plan ("what to do this week"),
// version B leads with the money ("what you may be owed"). Same mechanism as the homepage test (src/lib/home-ab.ts):
// the proxy assigns a person once (a cookie, no personal data) and REWRITES the address to the variant's page, so the
// URL, the canonical link and the cache stay as they are. Bots, signed-in people and the kill switch always get A.
//
// Kill switch: set AFTER_LAYOFF_AB=off in Vercel and redeploy. Anything else, or unset: the test runs.
//
// Measurement: both versions fire landing_viewed and plan_started with a `variant` property (PostHog; plan_started also
// goes to GA4 for the ad account). The winner is the version whose visitors finish the Market Reality Assessment more
// often, found by joining plan_started to the assessment's own completion event by person in PostHog.

export const AFTER_LAYOFF_AB_COOKIE = 'nc_ab_after_layoff'
export const AFTER_LAYOFF_AB_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
export const AFTER_LAYOFF_PATH = '/after-a-layoff'
/** The variant page's address: under /ab, never linked, never indexed. */
export const AFTER_LAYOFF_VARIANT_PATH = '/ab/after-layoff-b'

export type AfterLayoffVariant = HomeVariant

export const afterLayoffAbOn = (value: string | undefined = process.env.AFTER_LAYOFF_AB): boolean => (value ?? '').trim().toLowerCase() !== 'off'

export function decideAfterLayoffVariant(input: {
  cookie: string | undefined | null
  userAgent: string | null
  enabled?: boolean
  hasSession?: boolean
  random?: () => number
}): HomeVariantDecision {
  return decideHomeVariant({ ...input, enabled: input.enabled ?? afterLayoffAbOn() })
}
