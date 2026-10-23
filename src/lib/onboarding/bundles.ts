// The onboarding question bundles (docs/personalization-audit/bundles.md, O1 to O5).
//
// Rules every bundle follows, and the tests in bundles.test.ts hold it to:
//  - At most three questions at a time, on whatever journey the member picked.
//  - "Why we ask" comes first; the payoff (payoff.ts) updates as they answer.
//  - Money is NOT asked here: no pay floor, past salary, runway or savings. Those live in the opt-in
//    Finances and benefits flow (src/app/dashboard/money-help, docs/finances-and-benefits.md).
//  - Two to four options are adjacent buttons; five or more are a dropdown (design-principles.md).
//
// Pure and client-safe: the same definitions drive the screens, the server actions and the tests.

import { APPLY_TIMING, JOURNEYS, LAID_OFF_TIMING, MOVE_DRIVERS, getJourney, type JourneyType } from '@/lib/journey/journey'
import { INTENSITY_OPTIONS } from '@/lib/journey/intensity'
import {
  CHANGE_PACE_OPTIONS,
  COACHING_STYLE_OPTIONS,
  GAP_DURATION_LABELS,
  HIGHEST_LEVEL_OPTIONS,
  JOURNEY_TO_SITUATION,
  LOCATION_PREFERENCE_OPTIONS,
  PRIMARY_FUNCTION_OPTIONS,
  SITUATION_TO_JOURNEY,
  type SituationKey,
} from '@/lib/constants/onboarding'

export type BundleId = 'where_you_are' | 'resume' | 'aiming' | 'where' | 'coach'

export const BUNDLE_ORDER: readonly BundleId[] = ['where_you_are', 'resume', 'aiming', 'where', 'coach']

/** The page each bundle lives at. The first four keep the classic URLs so links, redirects and revalidation keep working. */
export const BUNDLE_ROUTE: Record<BundleId, string> = {
  where_you_are: '/onboarding/desire',
  resume: '/onboarding/resume',
  aiming: '/onboarding/confirm',
  where: '/onboarding/location',
  coach: '/onboarding/coach',
}

export interface BundleMeta {
  id: BundleId
  title: string
  /** "Why we ask", shown before the first question. */
  why: string
  /** The label on the one primary action. */
  action: string
  /** A rough time, so the member knows it is short. */
  seconds: number
}

export const BUNDLES: Record<BundleId, BundleMeta> = {
  where_you_are: {
    id: 'where_you_are',
    title: 'Where you are',
    why: 'We use this to set your first week and what you see on your home page. You can change it any time.',
    action: 'Continue',
    seconds: 20,
  },
  resume: {
    id: 'resume',
    title: 'Your résumé',
    why: 'Your résumé answers most of our questions for you, so you do not have to type them. It stays private.',
    action: 'Continue',
    seconds: 60,
  },
  aiming: {
    id: 'aiming',
    title: 'What you are aiming for',
    why: 'These three answers decide which jobs we show you. If we read your résumé we filled them in; correct anything that is off.',
    action: 'Continue',
    seconds: 30,
  },
  where: {
    id: 'where',
    title: 'Where you want to work',
    why: 'Place and work setup decide which jobs are close enough to count. Nobody else sees your address.',
    action: 'Continue',
    seconds: 30,
  },
  coach: {
    id: 'coach',
    title: 'How we coach you',
    why: 'This sets the tone of every message and how big your first week is. You can change it any time.',
    action: 'See what you gained',
    seconds: 20,
  },
}

export type QuestionId =
  | 'situation'
  | 'startTiming'
  | 'lastDayWorked'
  | 'applyTiming'
  | 'moveDriver'
  | 'gapDuration'
  | 'returnDate'
  | 'offering'
  | 'openDays'
  | 'venture'
  | 'resume'
  | 'targetRole'
  | 'function'
  | 'level'
  | 'place'
  | 'workSetup'
  | 'relocation'
  | 'pushStyle'
  | 'pace'
  | 'intensity'

export type QuestionKind = 'cards' | 'choice' | 'select' | 'text' | 'date' | 'number' | 'upload'

export interface Option {
  value: string
  label: string
  hint?: string
}

export interface Question {
  id: QuestionId
  kind: QuestionKind
  label: string
  help?: string
  required: boolean
  options?: readonly Option[]
  placeholder?: string
  maxLength?: number
  min?: number
  max?: number
}

export type Answers = Partial<Record<QuestionId, string>>

export interface QuestionContext {
  journey: JourneyType | null
}

/** The journey a situation card stands for. */
export function journeyOfSituation(situation: string | null | undefined): JourneyType | null {
  return situation && situation in SITUATION_TO_JOURNEY ? SITUATION_TO_JOURNEY[situation as SituationKey] : null
}

const SITUATION_OPTIONS: Option[] = JOURNEYS.map((j) => ({ value: JOURNEY_TO_SITUATION[j.key], label: j.card.label, hint: j.card.description }))

const toOptions = (list: readonly { key: string; label: string }[]): Option[] => list.map((o) => ({ value: o.key, label: o.label }))

export const GAP_OPTIONS: Option[] = Object.entries(GAP_DURATION_LABELS).map(([value, label]) => ({ value, label }))

const Q = {
  situation: { id: 'situation', kind: 'cards', label: 'Which of these sounds most like you?', required: true, options: SITUATION_OPTIONS },
  startTiming: { id: 'startTiming', kind: 'choice', label: 'When do you want to start looking?', required: false, options: toOptions(LAID_OFF_TIMING) },
  lastDayWorked: { id: 'lastDayWorked', kind: 'date', label: 'Your last day at work', help: 'It sets the dates that matter, like benefits and how long you have been out.', required: false },
  applyTiming: { id: 'applyTiming', kind: 'choice', label: 'When do you want to start applying?', required: true, options: toOptions(APPLY_TIMING) },
  moveDriver: { id: 'moveDriver', kind: 'choice', label: 'What is behind the move?', required: false, options: toOptions(MOVE_DRIVERS) },
  gapDuration: { id: 'gapDuration', kind: 'choice', label: 'How long have you been searching?', required: true, options: GAP_OPTIONS },
  returnDate: { id: 'returnDate', kind: 'date', label: 'When do you expect to be back?', help: 'We will check in as it gets close and keep everything else light until then.', required: false },
  offering: { id: 'offering', kind: 'text', label: 'In one line, who do you help and what result do you deliver?', placeholder: 'I help Series B software companies cut churn in two quarters', required: false, maxLength: 200 },
  openDays: { id: 'openDays', kind: 'number', label: 'Days a week open for new work', required: false, min: 0, max: 5 },
  venture: { id: 'venture', kind: 'text', label: 'In one line, what are you building?', placeholder: 'A bakery supply company for restaurants', required: false, maxLength: 200 },
  resume: { id: 'resume', kind: 'upload', label: 'Upload your résumé (PDF or DOCX, up to 10 MB)', required: true },
  targetRole: { id: 'targetRole', kind: 'text', label: 'What role are you aiming for next?', required: false, maxLength: 120 },
  function: { id: 'function', kind: 'select', label: 'Your main job function', required: true, options: PRIMARY_FUNCTION_OPTIONS.map((f) => ({ value: f, label: f })) },
  level: { id: 'level', kind: 'select', label: 'The highest level you have reached', required: true, options: HIGHEST_LEVEL_OPTIONS.map((l) => ({ value: l, label: l === 'IC' ? 'Individual contributor' : l })) },
  place: { id: 'place', kind: 'text', label: 'City and state where you search from', placeholder: 'Columbus, OH', required: false, maxLength: 80 },
  workSetup: { id: 'workSetup', kind: 'choice', label: 'How do you want to work?', required: true, options: LOCATION_PREFERENCE_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
  relocation: { id: 'relocation', kind: 'choice', label: 'Would you move for the right role?', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  pushStyle: { id: 'pushStyle', kind: 'choice', label: 'When you are stuck, what kind of push helps?', required: false, options: COACHING_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
  pace: { id: 'pace', kind: 'choice', label: 'How do you like to make progress?', required: false, options: CHANGE_PACE_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
  intensity: { id: 'intensity', kind: 'choice', label: 'How actively are you looking?', required: true, options: INTENSITY_OPTIONS.map((o) => ({ value: o.key, label: o.label, hint: o.hint })) },
} as const satisfies Record<string, Question>

/** The follow-up questions after the situation card, by journey. */
function followUps(journey: JourneyType): Question[] {
  switch (journey) {
    case 'LAID_OFF':
      return [Q.startTiming, Q.lastDayWorked]
    case 'EXPLORING_MOVE':
      return [Q.applyTiming, Q.moveDriver]
    case 'PROMOTION':
    case 'CAREER_CHANGE':
    case 'NEXT_ACT':
      return [Q.applyTiming]
    case 'STUDENT_NEW_GRAD':
    case 'RETURNING':
      return [Q.gapDuration]
    case 'TIME_OFF':
      return [Q.returnDate]
    case 'FRACTIONAL':
      return [Q.offering, Q.openDays]
    case 'ENTREPRENEUR':
      return [Q.venture]
    case 'GROWING':
    default:
      return []
  }
}

/** The questions to show now, never more than three. */
export function bundleQuestions(id: BundleId, ctx: QuestionContext): Question[] {
  switch (id) {
    case 'where_you_are':
      return ctx.journey ? [Q.situation, ...followUps(ctx.journey)] : [Q.situation]
    case 'resume':
      return [Q.resume]
    case 'aiming':
      return [Q.targetRole, Q.function, Q.level]
    case 'where':
      return [Q.place, Q.workSetup, Q.relocation]
    case 'coach': {
      // Employed members already said how soon they want to apply, which is how hard they are looking.
      // People who are not looking at all are not asked either.
      const j = ctx.journey ? getJourney(ctx.journey) : null
      const asksIntensity = !!j && j.searching && !j.employed
      return asksIntensity ? [Q.pushStyle, Q.pace, Q.intensity] : [Q.pushStyle, Q.pace]
    }
  }
}

/** The profile fields each question writes, so a reviewer can see at a glance that no money field is among them. */
export const QUESTION_FIELDS: Record<QuestionId, readonly string[]> = {
  situation: ['journey', 'journeyStage', 'currentJobStatus', 'confidentialSearchMode'],
  startTiming: ['journeyDetails.startTiming', 'journeyStage'],
  lastDayWorked: ['lastJobEndedAt', 'gapDuration'],
  applyTiming: ['journeyDetails.applyTiming', 'journeyStage', 'searchIntensity'],
  moveDriver: ['journeyDetails.moveDriver'],
  gapDuration: ['gapDuration'],
  returnDate: ['journeyDetails.returnDate'],
  offering: ['journeyDetails.offering'],
  openDays: ['journeyDetails.openDays'],
  venture: ['journeyDetails.venture'],
  resume: ['resumeStepComplete'],
  targetRole: ['targetRoleType'],
  function: ['primaryFunction'],
  level: ['highestLevelReached'],
  place: ['currentCity', 'currentState'],
  workSetup: ['remotePreference'],
  relocation: ['openToRelocation', 'onboardingLocationConfirmedAt'],
  pushStyle: ['coachingStylePreference'],
  pace: ['changePacePreference'],
  intensity: ['searchIntensity'],
}

/** Money fields that belong to the opt-in Finances and benefits flow and must never be written by onboarding. */
export const MONEY_FIELDS: readonly string[] = [
  'targetCompMin',
  'compFlexible',
  'priorityMaxComp',
  'lastSalary',
  'salaryConfirmedAt',
  'savings',
  'runway',
  'monthlyNeed',
  'severance',
  'equity',
]

export interface ValidationResult {
  ok: boolean
  /** Plain language: what is missing and what to do next. Empty when ok. */
  message: string
  /** The required questions still unanswered. */
  missing: QuestionId[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

function validDate(v: string): boolean {
  return DATE.test(v) && !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime())
}

/** Whether an answer is acceptable for a question (empty is acceptable only for optional questions). */
export function answerIsValid(q: Question, raw: string | undefined): boolean {
  const v = (raw ?? '').trim()
  if (v === '') return !q.required
  switch (q.kind) {
    case 'cards':
    case 'choice':
    case 'select':
      return (q.options ?? []).some((o) => o.value === v)
    case 'date':
      return validDate(v)
    case 'number': {
      const n = Number(v)
      return Number.isInteger(n) && n >= (q.min ?? 0) && n <= (q.max ?? 1000)
    }
    case 'text':
      return v.length <= (q.maxLength ?? 200)
    case 'upload':
      return true
  }
}

/** Checks a bundle's answers. Never clears anything: the caller keeps the member's input on error. */
export function validateAnswers(id: BundleId, ctx: QuestionContext, answers: Answers): ValidationResult {
  const questions = bundleQuestions(id, ctx)
  const missing = questions.filter((q) => q.required && (answers[q.id] ?? '').trim() === '').map((q) => q.id)
  if (missing.length > 0) {
    const first = questions.find((q) => q.id === missing[0])!
    const more = missing.length > 1 ? ` (and ${missing.length - 1} more)` : ''
    return { ok: false, missing, message: `Answer “${first.label}”${more} to continue. It is the only thing we need before the next step.` }
  }
  const bad = questions.find((q) => !answerIsValid(q, answers[q.id]))
  if (bad) return { ok: false, missing: [], message: `That answer to “${bad.label}” did not look right. Check it and try again; your other answers are kept.` }
  return { ok: true, message: '', missing: [] }
}

/** Required questions still open, in order, for the "why is this button off" line. */
export function openRequired(id: BundleId, ctx: QuestionContext, answers: Answers): Question[] {
  return bundleQuestions(id, ctx).filter((q) => q.required && (answers[q.id] ?? '').trim() === '')
}

/** Keeps only the stored answers that are valid for the questions shown, so a value the lists do not know never sits half-selected. */
export function usableAnswers(id: BundleId, ctx: QuestionContext, answers: Answers): Answers {
  const out: Answers = {}
  for (const q of bundleQuestions(id, ctx)) {
    const v = (answers[q.id] ?? '').trim()
    if (v !== '' && answerIsValid(q, v)) out[q.id] = v
  }
  return out
}

/** The bundle after this one, or null after the last. */
export function nextBundle(id: BundleId): BundleId | null {
  const i = BUNDLE_ORDER.indexOf(id)
  return i >= 0 && i < BUNDLE_ORDER.length - 1 ? BUNDLE_ORDER[i + 1] : null
}

/** "Step 2 of 5" style position. */
export function bundlePosition(id: BundleId): { step: number; of: number } {
  return { step: BUNDLE_ORDER.indexOf(id) + 1, of: BUNDLE_ORDER.length }
}
