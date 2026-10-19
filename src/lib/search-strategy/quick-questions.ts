// The one-at-a-time question flow on Search strategy. Each question is a single choice that writes to a
// field that already exists and that the rest of NextChapter already reads (the personalization spine,
// src/lib/personalization/spine.ts, says what each one drives), so nothing is asked twice. The questions
// that need several fields at once (target role and industries, blockers and motivations, culture) stay
// in the longer forms. Pure and client-safe: the whitelist and validation live here so they are tested;
// the server action only applies the result.

import type { Prisma } from '@prisma/client'
import { PAY_FLOOR_BANDS, payFloorFromBand } from '@/lib/onboarding/pay-floor'
import { SEARCH_STALL_OPTIONS, parseSearchStallPoint } from '@/lib/onboarding/search-stall'

export interface QuickOption {
  value: string
  label: string
}

export interface QuickQuestion {
  /** The spine signal key: what says whether it is already answered, and what it drives. */
  key: string
  /** The profile field it writes (for the spine's own "is it set" check and for analytics). */
  field: string
  /** Four or fewer options are adjacent buttons; more are a dropdown (design principles). */
  options: QuickOption[]
  /** Turns the chosen value into a profile update, or null if it is not one of the options. */
  toData: (value: string) => Prisma.CandidateProfileUncheckedUpdateInput | null
}

const pick = <T extends string>(allowed: readonly T[], v: string): T | null => (allowed as readonly string[]).includes(v) ? (v as T) : null

export const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    key: 'comp_floor',
    field: 'targetCompMin',
    options: PAY_FLOOR_BANDS.map((b) => ({ value: b.value, label: b.label })),
    toData: (v) => {
      const floor = payFloorFromBand(v)
      return floor ? { targetCompMin: floor } : null
    },
  },
  {
    key: 'search_stall_point',
    field: 'searchStallPoint',
    options: SEARCH_STALL_OPTIONS,
    toData: (v) => {
      const point = parseSearchStallPoint(v)
      return point ? { searchStallPoint: point } : null
    },
  },
  {
    key: 'pace',
    field: 'searchIntensity',
    options: [
      { value: 'ACTIVELY_SEARCHING', label: 'Actively looking' },
      { value: 'CASUALLY_LOOKING', label: 'Casually looking' },
      { value: 'EXPLORING', label: 'Just exploring' },
      { value: 'OPEN', label: 'Open to the right thing' },
    ],
    toData: (v) => {
      const searchIntensity = pick(['ACTIVELY_SEARCHING', 'CASUALLY_LOOKING', 'EXPLORING', 'OPEN'] as const, v)
      return searchIntensity ? { searchIntensity } : null
    },
  },
  {
    key: 'application_volume',
    field: 'applicationVolumeGoal',
    options: [
      { value: '3', label: '3 a week' },
      { value: '5', label: '5 a week' },
      { value: '10', label: '10 a week' },
      { value: '20', label: '20 a week' },
    ],
    toData: (v) => (['3', '5', '10', '20'].includes(v) ? { applicationVolumeGoal: Number(v) } : null),
  },
  {
    key: 'network_comfort',
    field: 'networkComfortLevel',
    options: [
      { value: 'VERY_COMFORTABLE', label: 'Very comfortable' },
      { value: 'SOMEWHAT_COMFORTABLE', label: 'Somewhat comfortable' },
      { value: 'NOT_VERY_COMFORTABLE', label: 'Not very comfortable' },
      { value: 'RATHER_NOT', label: "I'd rather not" },
    ],
    toData: (v) => {
      const networkComfortLevel = pick(['VERY_COMFORTABLE', 'SOMEWHAT_COMFORTABLE', 'NOT_VERY_COMFORTABLE', 'RATHER_NOT'] as const, v)
      return networkComfortLevel ? { networkComfortLevel } : null
    },
  },
  {
    key: 'coaching_style',
    field: 'coachingStylePreference',
    options: [
      { value: 'TOUGH_LOVE', label: 'Tough love: tell me straight' },
      { value: 'GENTLE_ENCOURAGEMENT', label: 'Gentle encouragement' },
      { value: 'SOMEWHERE_IN_BETWEEN', label: 'A mix of both' },
    ],
    toData: (v) => {
      const coachingStylePreference = pick(['TOUGH_LOVE', 'GENTLE_ENCOURAGEMENT', 'SOMEWHERE_IN_BETWEEN'] as const, v)
      return coachingStylePreference ? { coachingStylePreference } : null
    },
  },
  {
    key: 'change_readiness',
    field: 'changeReadiness',
    options: [
      { value: 'NOT_LOOKING_FOR_BIG_CHANGE', label: 'Not looking for a big change' },
      { value: 'WANT_CHANGE_NOT_READY_YET', label: 'I want a change, but not ready yet' },
      { value: 'WANT_CHANGE_AND_READY', label: 'I want a change and I am ready' },
    ],
    toData: (v) => {
      const changeReadiness = pick(['NOT_LOOKING_FOR_BIG_CHANGE', 'WANT_CHANGE_NOT_READY_YET', 'WANT_CHANGE_AND_READY'] as const, v)
      return changeReadiness ? { changeReadiness } : null
    },
  },
]

export const quickQuestionFor = (key: string) => QUICK_QUESTIONS.find((q) => q.key === key)

/** Buttons for four options or fewer, a dropdown for more. */
export const asButtons = (q: QuickQuestion) => q.options.length <= 4

export interface QueuedQuestion {
  key: string
  field: string
  question: string
  /** What the answer drives, in one line. */
  why: string
  /** What the member gets for answering. */
  gain: string
  options: QuickOption[]
  buttons: boolean
}

/**
 * The questions still to ask, in the spine's order: the spine gaps this member has that have a quick
 * question. `gaps` comes from spineGaps(), which already leaves out anything answered or not relevant to
 * this journey and stage.
 */
export function queueQuickQuestions(gaps: { key: string; label: string; why: string; unlocks: string }[]): QueuedQuestion[] {
  const out: QueuedQuestion[] = []
  for (const g of gaps) {
    const q = quickQuestionFor(g.key)
    if (!q) continue
    out.push({ key: q.key, field: q.field, question: g.label, why: g.why, gain: g.unlocks, options: q.options, buttons: asButtons(q) })
  }
  return out
}
