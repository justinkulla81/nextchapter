import type { CoachingFocus } from '@prisma/client'

// Prompt 60 — pure types/constants/validation for the Coaching Onboarding
// Form, split out from onboarding-form.ts (which is 'server-only' and talks
// to Prisma) specifically so client components — the coach's template
// editor and the candidate's answer form — can import the shared shapes and
// constants without pulling a server-only module into the client bundle.

export type OnboardingQuestionType = 'short_text' | 'long_text' | 'multiple_choice' | 'scale' | 'date'

// The four types a coach can pick when adding their own custom question —
// 'date' is reserved for the one baseline question that needs it and isn't
// offered as a custom-question type.
export const CUSTOM_QUESTION_TYPES: { value: Exclude<OnboardingQuestionType, 'date'>; label: string }[] = [
  { value: 'short_text', label: 'Short answer' },
  { value: 'long_text', label: 'Long answer' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'scale', label: 'Scale / rating' },
]

export type BaselineQuestionKey =
  | 'successOutcome'
  | 'offerDeadline'
  | 'priorCoaching'
  | 'sessionCadence'
  | 'betweenSessionContact'
  | 'accountabilityStyle'
  | 'nonNegotiables'
  | 'biggestWorry'

export interface EffectiveTemplateQuestion {
  id: string
  source: 'baseline' | 'custom'
  baselineKey?: BaselineQuestionKey
  section: string
  label: string
  type: OnboardingQuestionType
  options?: string[]
  scaleMax?: number
  optional?: boolean
  enabled: boolean
}

// A small starter library organized by the coach's own focus category
// (Prompt 33's categories) — optional prefab suggestions a coach can pull
// from when adding a custom question, rather than starting blank.
export const STARTER_QUESTION_LIBRARY: Record<
  CoachingFocus,
  { label: string; type: Exclude<OnboardingQuestionType, 'date'>; options?: string[] }[]
> = {
  CAREER: [
    { label: 'What would make this feel like a wasted engagement?', type: 'long_text' },
    { label: 'How many hours a week can you realistically commit to the search?', type: 'short_text' },
  ],
  LIFE: [
    { label: 'What does balance actually look like for you day to day?', type: 'long_text' },
    { label: 'Who else is affected by the decisions we make together?', type: 'long_text' },
  ],
  EXECUTIVE: [
    { label: 'What board or investor dynamics should I know about?', type: 'long_text' },
    {
      label: 'How visible do you want this search to be internally?',
      type: 'multiple_choice',
      options: ['Fully confidential', 'A few trusted people know', 'Openly known'],
    },
  ],
  EOS: [
    { label: "What's the biggest bottleneck in your current role?", type: 'long_text' },
    { label: 'How aligned is your leadership team on this transition?', type: 'scale' },
  ],
  OTHER: [{ label: 'Anything else I should know before we start?', type: 'long_text' }],
}

export type CoachingOnboardingAnswerValue = string | string[] | number
export type CoachingOnboardingAnswers = Record<string, CoachingOnboardingAnswerValue>

export interface AnswerValidationError {
  questionId: string
  message: string
}

export function validateAnswers(
  template: EffectiveTemplateQuestion[],
  answers: CoachingOnboardingAnswers
): AnswerValidationError[] {
  const errors: AnswerValidationError[] = []
  for (const q of template) {
    if (!q.enabled) continue
    const value = answers[q.id]
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    if (isEmpty) {
      if (!q.optional) errors.push({ questionId: q.id, message: 'This question needs an answer.' })
      continue
    }
    if (q.type === 'multiple_choice' && typeof value === 'string' && q.options && !q.options.includes(value)) {
      errors.push({ questionId: q.id, message: 'Please choose one of the listed options.' })
    }
    if (q.type === 'scale') {
      const num = typeof value === 'number' ? value : Number(value)
      const max = q.scaleMax ?? 5
      if (!Number.isFinite(num) || num < 1 || num > max) {
        errors.push({ questionId: q.id, message: `Please choose a number between 1 and ${max}.` })
      }
    }
  }
  return errors
}
