import type { JourneyType } from '@prisma/client'

// The 13 situations (src/lib/constants/personas.ts) as two short questions instead of one long list.
// Question 1 is a broad "where are you" with four answers; question 2 narrows to one situation
// with at most four answers. Every persona slug appears in exactly one group (tested).

export interface JourneyGroup {
  key: string
  /** The button on question 1. */
  label: string
  /** One plain line under the label. */
  hint: string
  /** The heading on question 2. */
  question: string
  /** Persona slugs, in the order shown on question 2. */
  slugs: string[]
  /** Only people out of work are asked how long it has been going on. */
  asksDuration: boolean
}

export const JOURNEY_GROUPS: JourneyGroup[] = [
  {
    key: 'out',
    label: 'I’m out of work',
    hint: 'Laid off, resigned, searching a long time, or taking a break',
    question: 'What best describes it?',
    slugs: ['laid-off', 'resigned', 'searching-too-long', 'taking-a-break'],
    asksDuration: true,
  },
  {
    key: 'working',
    label: 'I have a job and want what’s next',
    hint: 'Thinking about a move, a promotion, or managing my career',
    question: 'What are you after?',
    slugs: ['thinking-about-a-move', 'promotion', 'managing-my-career', 'returning'],
    asksDuration: false,
  },
  {
    key: 'direction',
    label: 'I’m changing direction or starting out',
    hint: 'A new field, or a first job after school',
    question: 'Which is closer?',
    slugs: ['career-change', 'new-grad'],
    asksDuration: false,
  },
  {
    key: 'own',
    label: 'I’m doing my own thing',
    hint: 'Fractional work, a side business, or planning my next act',
    question: 'Which is closer?',
    slugs: ['happy-with-fractional-work', 'building-something', 'next-act'],
    asksDuration: false,
  },
]

export function groupForSlug(slug: string): JourneyGroup | undefined {
  return JOURNEY_GROUPS.find((g) => g.slugs.includes(slug))
}

// The same four questions for onboarding's twelve journey cards (src/lib/journey/journey.ts), which are not the thirteen
// homepage situations: each journey sits in exactly one group (tested), at most four to a group, so the first onboarding
// question is two short screens instead of a list of twelve. The four group labels are the homepage picker's.
export type OnboardingGroupKey = 'out' | 'working' | 'direction' | 'own'

// "Returning after a break" is about explaining a gap, so it sits with the people out of work, not with those who have a job.
const ONBOARDING_JOURNEYS: Record<OnboardingGroupKey, JourneyType[]> = {
  out: ['LAID_OFF', 'RETURNING', 'TIME_OFF'],
  working: ['EXPLORING_MOVE', 'GROWING', 'PROMOTION'],
  direction: ['CAREER_CHANGE', 'STUDENT_NEW_GRAD'],
  own: ['FRACTIONAL', 'ENTREPRENEUR', 'BUY_BUSINESS', 'NEXT_ACT'],
}

// The hint says what is inside this group's cards, which are not the homepage's situations.
const ONBOARDING_HINTS: Record<OnboardingGroupKey, string> = {
  out: 'Laid off, coming back after a break, or on leave',
  working: 'Thinking about a move, a promotion, or managing my career',
  direction: 'A new field, or a first job after school',
  own: 'Fractional work, my own venture, buying a business, or planning my next act',
}

export interface OnboardingGroup {
  key: OnboardingGroupKey
  label: string
  hint: string
  journeys: JourneyType[]
}

export const ONBOARDING_GROUPS: OnboardingGroup[] = JOURNEY_GROUPS.map((g) => {
  const key = g.key as OnboardingGroupKey
  return { key, label: g.label, hint: ONBOARDING_HINTS[key], journeys: ONBOARDING_JOURNEYS[key] }
})

export function onboardingGroupOfJourney(journey: JourneyType | null | undefined): OnboardingGroup | undefined {
  return journey ? ONBOARDING_GROUPS.find((g) => g.journeys.includes(journey)) : undefined
}
