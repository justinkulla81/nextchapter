import { flowOfProfile } from '@/lib/onboarding/flag'
import { afterAccountPath, nextPreAccountPath, progressOf } from '@/lib/onboarding/progress'

// Where a person who started the registration path is now: the first page of onboarding they have not finished,
// which is the page they fell off at if they never came back. Mirrors the hub (src/app/onboarding/page.tsx) so the
// admin funnel and the real redirect always agree. Pure: registration-stop.test.ts.

export interface StopInput {
  journeyDetails: unknown
  desireComplete: boolean
  resumeStepComplete: boolean
  firstName: string | null
  lastName: string | null
  email: string | null
  onboardingResumeConfirmedAt: unknown
  onboardingLocationConfirmedAt: unknown
  onboardingComfortConfirmedAt: unknown
  contractAcceptedAt: unknown
  registrationCompletedAt: unknown
  introCommittedAt: unknown
  duplicateEmailBlockedAt: unknown
}

export interface Stop {
  /** Position in the path; a higher rank went further. */
  rank: number
  label: string
  /** The page they stopped on; null once onboarding is finished. */
  path: string | null
}

/** Every place a person can stop, in the order the path runs. Both flows (short bundles and classic) map onto these. */
export const STOPS: Stop[] = [
  { rank: 0, label: 'Questions: where you are', path: '/onboarding/desire' },
  { rank: 1, label: 'Résumé', path: '/onboarding/resume' },
  { rank: 2, label: 'Name and email', path: '/onboarding/details' },
  { rank: 3, label: 'Aiming, level and function', path: '/onboarding/confirm' },
  { rank: 4, label: 'Where you can work', path: '/onboarding/location' },
  { rank: 5, label: 'Coach and comfort', path: '/onboarding/coach' },
  { rank: 6, label: 'Create the account', path: '/onboarding/create-account' },
  { rank: 7, label: 'Payoff: what we found', path: '/onboarding/finish' },
  { rank: 8, label: 'Welcome', path: '/onboarding/welcome' },
  { rank: 9, label: 'Finished onboarding', path: null },
]

// Pages that belong to a stop but are not its canonical path (the classic flow, and the Google variant of the account step).
const ALIASES: Record<string, number> = {
  '/onboarding/comfort': 5,
  '/onboarding/contract': 5,
  '/onboarding/coach-consent': 5,
  '/onboarding/coaching-form': 5,
  '/onboarding/connect': 6,
  '/onboarding/score': 6,
  '/onboarding/google': 8,
  '/dashboard': 9,
}

function stopForPath(path: string): Stop {
  const alias = ALIASES[path]
  if (alias != null) return STOPS[alias]
  return STOPS.find((s) => s.path === path) ?? STOPS[0]
}

export function registrationStop(p: StopInput): Stop {
  const registered = !!p.registrationCompletedAt
  if (p.duplicateEmailBlockedAt) return STOPS[6]
  if (flowOfProfile(p) === 'bundles') {
    if (registered) {
      return stopForPath(afterAccountPath({ ...progressOf(p.journeyDetails), introCommitted: !!p.introCommittedAt }))
    }
    return stopForPath(nextPreAccountPath(p))
  }
  if (!p.desireComplete) return STOPS[0]
  if (!p.resumeStepComplete) return STOPS[1]
  if (!p.onboardingResumeConfirmedAt) return STOPS[3]
  if (!p.onboardingLocationConfirmedAt) return STOPS[4]
  if (!p.onboardingComfortConfirmedAt || !p.contractAcceptedAt) return STOPS[5]
  if (!registered) return STOPS[6]
  return p.introCommittedAt ? STOPS[9] : STOPS[8]
}
