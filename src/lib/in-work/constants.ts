// In-work track: the fixed vocabularies, checklists and defaults. Pure and
// client-safe. The database stores these keys as plain text (see the
// InWork* models in schema.prisma), so adding one never needs DDL.

import type { JourneyType, JourneyStage } from '@prisma/client'
import { effectiveJourney, effectiveStage } from '@/lib/journey/journey'

// The journeys that are employed and get the workspace.
export const IN_WORK_JOURNEYS: readonly JourneyType[] = ['PROMOTION', 'EXPLORING_MOVE', 'NEXT_ACT']

type JourneyFields = Parameters<typeof effectiveJourney>[0]

export function isInWorkMember(p: JourneyFields): boolean {
  const journey = effectiveJourney(p)
  return !!journey && IN_WORK_JOURNEYS.includes(journey)
}

// Paused members get no nudges, so no review emails.
export function isPausedMember(p: JourneyFields): boolean {
  return (effectiveStage(p) as JourneyStage | null) === 'PAUSED'
}

export const FEEDBACK_SOURCES = [
  { key: 'MANAGER', label: 'My manager' },
  { key: 'SKIP_LEVEL', label: 'My manager\'s manager' },
  { key: 'PEER', label: 'A peer' },
  { key: 'DIRECT_REPORT', label: 'Someone I manage' },
  { key: 'CLIENT', label: 'A client or partner' },
  { key: 'OTHER', label: 'Someone else' },
] as const
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number]['key']

export const FEEDBACK_CATEGORIES = [
  { key: 'STRENGTH', label: 'A strength' },
  { key: 'GROWTH_AREA', label: 'A growth area' },
  { key: 'RESULTS', label: 'Results and output' },
  { key: 'COMMUNICATION', label: 'Communication' },
  { key: 'BEHAVIOR', label: 'How I work with others' },
  { key: 'OTHER', label: 'Something else' },
] as const
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]['key']

export const REVIEW_CADENCES = [
  { key: 'HALF_YEARLY', label: 'Twice a year' },
  { key: 'ANNUAL', label: 'Once a year' },
  { key: 'QUARTERLY', label: 'Every quarter' },
] as const
export type ReviewCadence = (typeof REVIEW_CADENCES)[number]['key']

export function isReviewCadence(v: unknown): v is ReviewCadence {
  return REVIEW_CADENCES.some((c) => c.key === v)
}
export function isFeedbackSource(v: unknown): v is FeedbackSource {
  return FEEDBACK_SOURCES.some((c) => c.key === v)
}
export function isFeedbackCategory(v: unknown): v is FeedbackCategory {
  return FEEDBACK_CATEGORIES.some((c) => c.key === v)
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

// Review prep checklist. Keys are stored, so never reuse one for a new meaning.
export const PREP_CHECKLIST = [
  { key: 'log_wins', label: 'Log every win since your last review, with numbers' },
  { key: 'review_summary', label: 'Read your one-page impact summary and cut it to the top five' },
  { key: 'goals', label: 'Write the goals you want for the next period' },
  { key: 'the_ask', label: 'Decide your ask: raise, promotion, scope or title' },
  { key: 'evidence', label: 'List the evidence you already operate at the next level' },
  { key: 'questions', label: 'Write three questions for your manager' },
  { key: 'feedback', label: 'Re-read the feedback you logged this period' },
  { key: 'rehearse', label: 'Say your ask out loud once' },
] as const

export const PREP_QUESTION_STARTERS = [
  'What would I need to show in the next six months to be considered for the next level?',
  'What is the one thing you would most like me to do differently?',
  'Which projects will matter most to the team next period, and how can I be on them?',
] as const

// The editable next-level gap checklist starts from these. The member can
// change, remove or add rows.
export const GAP_STARTERS = [
  'I own outcomes, not only tasks',
  'I make decisions in my area without being asked',
  'I teach or lead others on the team',
  'My work is visible beyond my direct manager',
  'I work across teams, not only inside mine',
  'I can state my results in numbers',
] as const

export const VISIBILITY_STARTERS = [
  'Share one result a month in a short written update to my manager',
  'Present at one team or cross-team meeting this quarter',
  'Book a monthly 1:1 with one leader outside my reporting line',
  'Volunteer for one project that crosses teams',
  'Mentor or onboard one newer colleague',
] as const

export const MAX_TEXT = 2000
export const MAX_LINE = 300
