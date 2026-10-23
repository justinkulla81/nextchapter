// Where a member is in the bundles flow, kept in journeyDetails (a Json column), so the new flow needs no
// schema change: { onboardingFlow: 'bundles', onboardingBundles: { completed, finishedAt, googleRevealAt } }.
// Pure: progress.test.ts.

import { BUNDLES_MARKER_KEY, BUNDLES_MARKER_VALUE } from '@/lib/onboarding/flag'
import { BUNDLE_ORDER, BUNDLE_ROUTE, type BundleId } from '@/lib/onboarding/bundles'

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
export const FINISH_PATH = '/onboarding/finish'

/**
 * Where the hub sends a member in the bundles flow who has not created an account yet. After the five question steps
 * comes one required step, "Continue with Google", which creates the account and connects Gmail and Calendar; the
 * payoff (finish) comes after it.
 */
export function nextPreAccountPath(p: {
  desireComplete: boolean
  resumeStepComplete: boolean
  onboardingResumeConfirmedAt: unknown
  onboardingLocationConfirmedAt: unknown
  journeyDetails: unknown
}): string {
  if (!p.desireComplete) return BUNDLE_ROUTE.where_you_are
  if (!p.resumeStepComplete) return BUNDLE_ROUTE.resume
  if (!p.onboardingResumeConfirmedAt) return BUNDLE_ROUTE.aiming
  if (!p.onboardingLocationConfirmedAt) return BUNDLE_ROUTE.where
  const done = progressOf(p.journeyDetails)
  if (!done.completed.includes('coach')) return BUNDLE_ROUTE.coach
  return CONNECT_PATH
}

/**
 * Where the hub sends a member in the bundles flow who has an account. The payoff first; members who registered
 * under the earlier order (account, then an optional Google reveal) still get that reveal once; then welcome.
 */
export function afterAccountPath(p: { finishedAt: string | null; googleRevealAt: string | null; introCommitted: boolean }): string {
  if (!p.finishedAt) return FINISH_PATH
  if (!p.googleRevealAt) return '/onboarding/google'
  return p.introCommitted ? '/dashboard' : '/onboarding/welcome'
}
