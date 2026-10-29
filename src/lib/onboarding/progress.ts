// Where a member is in the bundles flow, kept in journeyDetails (a Json column), so the new flow needs no
// schema change: { onboardingFlow: 'bundles', onboardingBundles: { completed, finishedAt, googleRevealAt } }.
// Pure: progress.test.ts.

import { BUNDLES_MARKER_KEY, BUNDLES_MARKER_VALUE } from '@/lib/onboarding/flag'
import { BUNDLE_ORDER, BUNDLE_ROUTE, type BundleId } from '@/lib/onboarding/bundles'
import { isGoogleConnectOn } from '@/lib/google/connect-switch'
import { DETAILS_PATH, needsContactDetails } from '@/lib/onboarding/details'

const KEY = 'onboardingBundles'

export interface BundleProgress {
  completed: BundleId[]
  /** The finish screen was shown and continued from. */
  finishedAt: string | null
  /** The Google reveal was answered (connected or skipped). */
  googleRevealAt: string | null
}

export function progressOf(journeyDetails: unknown): BundleProgress {
  const raw = (journeyDetails as Record<string, unknown> | null)?.[KEY] as Partial<Record<keyof BundleProgress, unknown>> | undefined
  const completed = Array.isArray(raw?.completed) ? (raw.completed as unknown[]).filter((c): c is BundleId => BUNDLE_ORDER.includes(c as BundleId)) : []
  return {
    completed,
    finishedAt: typeof raw?.finishedAt === 'string' ? raw.finishedAt : null,
    googleRevealAt: typeof raw?.googleRevealAt === 'string' ? raw.googleRevealAt : null,
  }
}

/** The journeyDetails patch (merged by applyJourneyChange) that records a change in progress. */
export function progressPatch(journeyDetails: unknown, change: { completed?: BundleId; finishedAt?: Date; googleRevealAt?: Date }): Record<string, unknown> {
  const now = progressOf(journeyDetails)
  const completed = change.completed && !now.completed.includes(change.completed) ? [...now.completed, change.completed] : now.completed
  return {
    [BUNDLES_MARKER_KEY]: BUNDLES_MARKER_VALUE,
    [KEY]: {
      completed,
      finishedAt: change.finishedAt ? change.finishedAt.toISOString() : now.finishedAt,
      googleRevealAt: change.googleRevealAt ? change.googleRevealAt.toISOString() : now.googleRevealAt,
    },
  }
}

export const CONNECT_PATH = '/onboarding/connect'
/** The account step while Google connect is off (src/lib/google/connect-switch.ts): an email and a password, confirmed by a link. */
export const CREATE_ACCOUNT_PATH = '/onboarding/create-account'

/** The page that creates the account, for the current state of the Google switch. */
export const accountStepPath = (googleOn: boolean = isGoogleConnectOn()): string => (googleOn ? CONNECT_PATH : CREATE_ACCOUNT_PATH)
export const FINISH_PATH = '/onboarding/finish'

/**
 * Where the hub sends a member in the bundles flow who has not created an account yet. After the five question steps
 * comes one required step that creates the account: "Continue with Google" (which also connects Gmail and Calendar) when
 * Google connect is on, otherwise an email and a password. The payoff (finish) comes after it.
 */
export function nextPreAccountPath(p: {
  desireComplete: boolean
  resumeStepComplete: boolean
  firstName: string | null
  lastName: string | null
  email: string | null
  onboardingResumeConfirmedAt: unknown
  onboardingLocationConfirmedAt: unknown
  journeyDetails: unknown
}, googleOn: boolean = isGoogleConnectOn()): string {
  if (!p.desireComplete) return BUNDLE_ROUTE.where_you_are
  if (!p.resumeStepComplete) return BUNDLE_ROUTE.resume
  // Nobody goes on without a name and an email: the résumé gave them, or this step asks (src/lib/onboarding/details.ts).
  if (needsContactDetails(p)) return DETAILS_PATH
  if (!p.onboardingResumeConfirmedAt) return BUNDLE_ROUTE.aiming
  if (!p.onboardingLocationConfirmedAt) return BUNDLE_ROUTE.where
  const done = progressOf(p.journeyDetails)
  if (!done.completed.includes('coach')) return BUNDLE_ROUTE.coach
  return accountStepPath(googleOn)
}

/**
 * Where the hub sends a member in the bundles flow who has an account. The payoff first; members who registered
 * under the earlier order (account, then an optional Google reveal) still get that reveal once, unless Google connect
 * is off; then welcome.
 */
export function afterAccountPath(p: { finishedAt: string | null; googleRevealAt: string | null; introCommitted: boolean }, googleOn: boolean = isGoogleConnectOn()): string {
  if (!p.finishedAt) return FINISH_PATH
  if (googleOn && !p.googleRevealAt) return '/onboarding/google'
  return p.introCommitted ? '/dashboard' : '/onboarding/welcome'
}
