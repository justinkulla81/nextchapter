// Which onboarding a member gets: the short question bundles (docs/personalization-audit/bundles.md,
// O1 to O5) or the classic screens. Pure, so server pages, actions and tests share it.
//
// The switch is ONBOARDING_BUNDLES=on (everyone), or the redesign allow-list (src/lib/redesign/flag.ts)
// where the member's email is known. Pre-account visitors have no email, so for them only the env
// switch applies. Default off.
//
// A member keeps the flow they started in, so flipping the switch never moves someone half way through:
//  - the bundles flow leaves a marker in journeyDetails (BUNDLES_MARKER_KEY) on its first screen;
//  - a member who answered the classic first screen (desireComplete, no marker) stays classic.

import { isRedesignOn } from '@/lib/redesign/flag'

export const BUNDLES_MARKER_KEY = 'onboardingFlow'
export const BUNDLES_MARKER_VALUE = 'bundles'

export type OnboardingFlow = 'bundles' | 'classic'

export function isOnboardingBundlesOn(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if ((env.ONBOARDING_BUNDLES ?? '').trim().toLowerCase() === 'on') return true
  return isRedesignOn(email, env)
}

export function hasBundlesMarker(journeyDetails: unknown): boolean {
  return (journeyDetails as Record<string, unknown> | null)?.[BUNDLES_MARKER_KEY] === BUNDLES_MARKER_VALUE
}

/** The flow for a loaded profile (or none yet). `userEmail` is the signed-in email when there is one; a pre-account visitor has none. */
export function flowOfProfile(
  profile: { journeyDetails?: unknown; desireComplete?: boolean | null; email?: string | null } | null,
  userEmail?: string | null,
  env?: Record<string, string | undefined>,
): OnboardingFlow {
  return resolveOnboardingFlow({ journeyDetails: profile?.journeyDetails, desireComplete: profile?.desireComplete, email: userEmail ?? profile?.email, env })
}

export function resolveOnboardingFlow(input: {
  journeyDetails?: unknown
  desireComplete?: boolean | null
  email?: string | null
  env?: Record<string, string | undefined>
}): OnboardingFlow {
  if (hasBundlesMarker(input.journeyDetails)) return 'bundles'
  if (input.desireComplete) return 'classic'
  return isOnboardingBundlesOn(input.email, input.env) ? 'bundles' : 'classic'
}
