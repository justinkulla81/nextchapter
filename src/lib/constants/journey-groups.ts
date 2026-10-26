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
