import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import {
  type BaselineQuestionKey,
  type CoachingOnboardingAnswers,
  type EffectiveTemplateQuestion,
  type OnboardingQuestionType,
} from '@/lib/coach/onboarding-form-shared'

// Prompt 60 — candidate-completed Coaching Onboarding Form. Deliberately
// distinct from any future coach-completed sensitive-topics intake: this
// form only ever carries standard, non-sensitive kickoff material (goal-
// setting + working-relationship logistics). Never add a sensitive-topics
// question here — that belongs to a separate, coach-only form if it's ever
// built.
//
// Server-only (talks to Prisma) — pure types/constants/validation that
// client components also need live in onboarding-form-shared.ts instead.
export * from '@/lib/coach/onboarding-form-shared'

interface BaselineQuestionDef {
  key: BaselineQuestionKey
  label: string
  type: OnboardingQuestionType
  options?: string[]
  optional?: boolean
}

// The NextChapter-provided default template. Standard kickoff material any
// good coach asks a new client — none of this touches Prompt 56's sensitive-
// topics guardrail list (that list doesn't exist in this codebase yet; if
// it's ever built, these questions should still never move onto it).
export const BASELINE_ONBOARDING_QUESTIONS: BaselineQuestionDef[] = [
  {
    key: 'successOutcome',
    label: 'What does a successful outcome from our work together look like to you?',
    type: 'long_text',
  },
  {
    key: 'offerDeadline',
    label: 'Is there a date by which you need to have accepted an offer?',
    type: 'date',
    optional: true,
  },
  {
    key: 'priorCoaching',
    label: "Have you worked with a career or executive coach before? What worked, what didn't?",
    type: 'long_text',
    optional: true,
  },
  {
    key: 'sessionCadence',
    label: 'Preferred session cadence',
    type: 'multiple_choice',
    options: ['Weekly', 'Biweekly', 'As-needed'],
  },
  {
    key: 'betweenSessionContact',
    label: 'Preferred between-session contact',
    type: 'multiple_choice',
    options: ['Email check-ins', 'Text', 'None unless urgent'],
  },
  {
    key: 'accountabilityStyle',
    label: 'Do you want to be checked on if you fall behind on action items, or do you prefer to self-direct?',
    type: 'multiple_choice',
    options: ['Check on me', "I'll self-direct"],
  },
  {
    key: 'nonNegotiables',
    label:
      'Non-negotiables or constraints on your search (location flexibility, caregiving responsibilities, industries to exclude)',
    type: 'long_text',
  },
  {
    key: 'biggestWorry',
    label: 'What are you most worried about in this process?',
    type: 'long_text',
    optional: true,
  },
]

const BASELINE_BY_KEY = new Map(BASELINE_ONBOARDING_QUESTIONS.map((q) => [q.key, q]))

const DEFAULT_SECTION = 'Getting started'

interface StoredBaselineTemplateQuestion {
  id: string
  source: 'baseline'
  baselineKey: BaselineQuestionKey
  section: string
  enabled: boolean
}

interface StoredCustomTemplateQuestion {
  id: string
  source: 'custom'
  section: string
  label: string
  type: Exclude<OnboardingQuestionType, 'date'>
  options?: string[]
  scaleMax?: number
  optional?: boolean
  enabled: boolean
}

export type StoredTemplateQuestion = StoredBaselineTemplateQuestion | StoredCustomTemplateQuestion

function getDefaultStoredTemplate(): StoredBaselineTemplateQuestion[] {
  return BASELINE_ONBOARDING_QUESTIONS.map((q) => ({
    id: `baseline:${q.key}`,
    source: 'baseline',
    baselineKey: q.key,
    section: DEFAULT_SECTION,
    enabled: true,
  }))
}

function resolveQuestion(q: StoredTemplateQuestion): EffectiveTemplateQuestion | null {
  if (q.source === 'baseline') {
    const def = BASELINE_BY_KEY.get(q.baselineKey)
    if (!def) return null
    return {
      id: q.id,
      source: 'baseline',
      baselineKey: q.baselineKey,
      section: q.section,
      label: def.label,
      type: def.type,
      options: def.options,
      optional: def.optional,
      enabled: q.enabled,
    }
  }
  return {
    id: q.id,
    source: 'custom',
    section: q.section,
    label: q.label,
    type: q.type,
    options: q.options,
    scaleMax: q.scaleMax,
    optional: q.optional,
    enabled: q.enabled,
  }
}

// Returns the coach's FULL template (including disabled questions) so the
// settings editor can offer re-enabling. Callers that need only what a
// candidate should see should filter to `.enabled`.
export function resolveTemplate(rawTemplate: unknown): EffectiveTemplateQuestion[] {
  const stored = (Array.isArray(rawTemplate) ? (rawTemplate as unknown as StoredTemplateQuestion[]) : null) ?? null
  const list = stored && stored.length > 0 ? stored : getDefaultStoredTemplate()
  return list.map(resolveQuestion).filter((q): q is EffectiveTemplateQuestion => q !== null)
}

export async function getCoachTemplate(coachId: string): Promise<EffectiveTemplateQuestion[]> {
  const coach = await prisma.coach.findUniqueOrThrow({ where: { id: coachId }, select: { onboardingTemplate: true } })
  return resolveTemplate(coach.onboardingTemplate)
}

export async function saveCoachTemplate(coachId: string, template: EffectiveTemplateQuestion[]): Promise<void> {
  const stored: StoredTemplateQuestion[] = template.map((q) =>
    q.source === 'baseline'
      ? { id: q.id, source: 'baseline', baselineKey: q.baselineKey as BaselineQuestionKey, section: q.section, enabled: q.enabled }
      : {
          id: q.id,
          source: 'custom',
          section: q.section,
          label: q.label,
          type: q.type as Exclude<OnboardingQuestionType, 'date'>,
          options: q.options,
          scaleMax: q.scaleMax,
          optional: q.optional,
          enabled: q.enabled,
        }
  )
  await prisma.coach.update({
    where: { id: coachId },
    data: { onboardingTemplate: stored as unknown as Prisma.InputJsonValue },
  })
}

export async function hasSubmittedCoachingOnboardingForm(candidateId: string): Promise<boolean> {
  const existing = await prisma.coachingOnboardingResponse.findUnique({
    where: { candidateId },
    select: { id: true },
  })
  return existing !== null
}

export async function submitCoachingOnboardingForm(
  candidateId: string,
  coachId: string,
  answers: CoachingOnboardingAnswers
): Promise<void> {
  await prisma.coachingOnboardingResponse.create({
    data: { candidateId, coachId, answers: answers as unknown as Prisma.InputJsonValue },
  })
}

export interface CoachingOnboardingAnswerDisplay {
  label: string
  value: string
}

// Resolves a candidate's raw answers back into (label, formatted value) pairs
// against the template that was effective at submission time — used by both
// Coaching Notes and the Pre-Session Brief so neither reimplements this.
export async function getCoachingOnboardingAnswersForDisplay(
  candidateId: string
): Promise<CoachingOnboardingAnswerDisplay[] | null> {
  const response = await prisma.coachingOnboardingResponse.findUnique({ where: { candidateId } })
  if (!response) return null
  const template = await getCoachTemplate(response.coachId)
  const answers = response.answers as unknown as CoachingOnboardingAnswers
  const byId = new Map(template.map((q) => [q.id, q]))

  return Object.entries(answers)
    .map(([id, value]) => {
      const q = byId.get(id)
      const label = q?.label ?? id
      const formatted = Array.isArray(value) ? value.join(', ') : String(value)
      return { label, value: formatted }
    })
    .filter((entry) => entry.value.trim() !== '')
}

// The Pre-Session Brief only needs two specific baseline answers (non-
// negotiables + biggest worry), not the full set — this looks them up
// directly by their fixed baseline ids rather than resolving the whole
// display list, since those two keys never change even if a coach renames
// sections or disables other questions.
export async function getKeyCoachingOnboardingAnswers(
  candidateId: string
): Promise<{ nonNegotiables: string | null; biggestWorry: string | null }> {
  const response = await prisma.coachingOnboardingResponse.findUnique({ where: { candidateId } })
  if (!response) return { nonNegotiables: null, biggestWorry: null }
  const answers = response.answers as unknown as CoachingOnboardingAnswers
  const nonNegotiables = answers['baseline:nonNegotiables']
  const biggestWorry = answers['baseline:biggestWorry']
  return {
    nonNegotiables: typeof nonNegotiables === 'string' && nonNegotiables.trim() ? nonNegotiables : null,
    biggestWorry: typeof biggestWorry === 'string' && biggestWorry.trim() ? biggestWorry : null,
  }
}
