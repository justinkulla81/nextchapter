// The finish screen: what the member gained from the bundles, and one optional next question. Pure:
// finish.test.ts. Every gain is something the site really did with an answer.

import type { JourneyStage, JourneyType } from '@/lib/journey/journey'
import { getJourney, moveDriverOf } from '@/lib/journey/journey'
import { firstWeekPreview, jobsLine, weeklyTargetMinutes, type JobCounts } from '@/lib/onboarding/payoff'

export interface Gain {
  /** Where it shows up: Home, Jobs, Plan. */
  place: string
  title: string
  detail: string
}

export interface FinishInput {
  journey: JourneyType | null
  stage: JourneyStage | null
  intensity: string | null
  /** Labels the résumé filled in. */
  prefilled: readonly string[]
  jobs: JobCounts | null
  hasCity: boolean
  details?: Record<string, unknown>
}

export function finishGains(i: FinishInput): Gain[] {
  const gains: Gain[] = []
  if (i.journey) {
    const steps = firstWeekPreview(i.journey, {}, i.stage, moveDriverOf(i.details))
    if (steps.length > 0) gains.push({ place: 'Plan', title: 'Your first week is planned', detail: steps[0] + (steps.length > 1 ? `, and ${steps.length - 1} more step${steps.length > 2 ? 's' : ''}.` : '.') })
  }
  if (i.prefilled.length > 0) gains.push({ place: 'Profile', title: `${i.prefilled.length} answers filled in from your résumé`, detail: 'You did not have to type them, and you can correct any of them later.' })
  if (i.jobs && i.jobs.now !== null) gains.push({ place: 'Jobs', title: jobsLine({ baseline: null, now: i.jobs.now }), detail: i.hasCity ? 'Each one will say in plain words why it fits.' : 'Add your city and the list narrows to jobs you can reach.' })
  const minutes = weeklyTargetMinutes(i.journey, i.stage, i.intensity)
  gains.push({ place: 'Home', title: `A first week of about ${minutes} minutes`, detail: i.journey ? `Sized for ${getJourney(i.journey).label.toLowerCase()}, and in the tone you chose.` : 'In the tone you chose.' })
  return gains
}

export interface NextQuestion {
  id: 'networkComfort'
  label: string
  gain: string
  options: { value: string; label: string }[]
}

const COMFORT_OPTIONS = [
  { value: 'VERY_COMFORTABLE', label: 'Very comfortable' },
  { value: 'SOMEWHAT_COMFORTABLE', label: 'Somewhat comfortable' },
  { value: 'NOT_VERY_COMFORTABLE', label: 'Not very comfortable' },
  { value: 'RATHER_NOT', label: 'I would rather not' },
]

export const NETWORK_COMFORT_VALUES: readonly string[] = COMFORT_OPTIONS.map((o) => o.value)

/** The one optional question after the bundles, or null when it is already answered. Best payoff first. */
export function nextOptionalQuestion(p: { networkComfortLevel: string | null; searching: boolean }): NextQuestion | null {
  if (p.networkComfortLevel) return null
  return {
    id: 'networkComfort',
    label: p.searching ? 'How comfortable are you letting people know you are looking?' : 'How comfortable are you reaching out to people about your career?',
    gain: 'We choose how many outreach steps you get and how warm the first messages are.',
    options: COMFORT_OPTIONS,
  }
}
