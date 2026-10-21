// What each bundle's answers write, as plain data. The server actions apply these; nothing here touches
// the database, so the mapping is testable. No money field is ever produced (bundles.ts MONEY_FIELDS).

import type { CoachingStylePreference, GapDurationBucket, SearchIntensity } from '@prisma/client'
import {
  APPLY_TIMING,
  LAID_OFF_TIMING,
  MOVE_DRIVERS,
  getJourney,
  stageForLaidOffTiming,
  stageForTiming,
  type ApplyTiming,
  type JourneyStage,
  type JourneyType,
  type LaidOffTiming,
  type MoveDriver,
} from '@/lib/journey/journey'
import { intensityFromTiming, INTENSITY_OPTIONS } from '@/lib/journey/intensity'
import { CHANGE_PACE_OPTIONS, COACHING_STYLE_OPTIONS, JOURNEY_TO_SITUATION } from '@/lib/constants/onboarding'
import { normalizeFunctionValue, normalizeLevelValue, normalizeRemotePreferenceValue } from '@/lib/constants/candidate-profile-normalize'
import type { Answers } from '@/lib/onboarding/bundles'

const clean = (v: string | undefined) => (v ?? '').trim()

/** "Columbus, OH" becomes city and state; "Columbus" is a city with no state. */
export function parsePlace(text: string | undefined): { city: string | null; state: string | null } {
  const t = clean(text)
  if (!t) return { city: null, state: null }
  const at = t.lastIndexOf(',')
  if (at < 0) return { city: t, state: null }
  const city = t.slice(0, at).trim()
  const state = t.slice(at + 1).trim()
  return { city: city || null, state: state ? (state.length <= 3 ? state.toUpperCase() : state) : null }
}

/** How long ago a date was, in the same buckets "How long have you been searching?" uses. Null for a date in the future. */
export function gapBucketFromDate(date: string, now = new Date()): GapDurationBucket | null {
  const d = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.getTime() > now.getTime()) return null
  const months = (now.getTime() - d.getTime()) / (30.4375 * 86_400_000)
  if (months < 3) return 'ZERO_TO_THREE_MONTHS'
  if (months < 6) return 'THREE_TO_SIX_MONTHS'
  if (months < 12) return 'SIX_TO_TWELVE_MONTHS'
  return 'TWELVE_PLUS_MONTHS'
}

export interface WhereYouAreWrites {
  stage?: JourneyStage
  details: Record<string, unknown>
  profile: { gapDuration?: GapDurationBucket; searchIntensity?: SearchIntensity; lastJobEndedAt?: Date }
}

/** O1 follow-ups: the stage they imply, the journey details, and the few profile columns that go with them. */
export function whereYouAreWrites(journey: JourneyType, answers: Answers, now = new Date()): WhereYouAreWrites {
  const j = getJourney(journey)
  const out: WhereYouAreWrites = { details: {}, profile: {} }

  const apply = APPLY_TIMING.find((t) => t.key === clean(answers.applyTiming))?.key as ApplyTiming | undefined
  if (j.employed && j.searching && apply) {
    out.stage = stageForTiming(journey, apply)
    out.details.applyTiming = apply
    out.profile.searchIntensity = intensityFromTiming(apply)
    const driver = MOVE_DRIVERS.find((d) => d.key === clean(answers.moveDriver))?.key as MoveDriver | undefined
    if (journey === 'EXPLORING_MOVE' && driver) out.details.moveDriver = driver
  }

  if (journey === 'LAID_OFF') {
    const timing = LAID_OFF_TIMING.find((t) => t.key === clean(answers.startTiming))?.key as LaidOffTiming | undefined
    if (timing) {
      out.stage = stageForLaidOffTiming(timing)
      out.details.startTiming = timing
    }
    const last = clean(answers.lastDayWorked)
    if (last) {
      out.profile.lastJobEndedAt = new Date(`${last}T12:00:00Z`)
      const bucket = gapBucketFromDate(last, now)
      if (bucket) out.profile.gapDuration = bucket
    }
  }

  const gap = clean(answers.gapDuration)
  if (gap && (journey === 'STUDENT_NEW_GRAD' || journey === 'RETURNING')) out.profile.gapDuration = gap as GapDurationBucket

  if (journey === 'TIME_OFF' && clean(answers.returnDate)) out.details.returnDate = clean(answers.returnDate)
  if (journey === 'FRACTIONAL') {
    if (clean(answers.offering)) out.details.offering = clean(answers.offering).slice(0, 200)
    if (clean(answers.openDays) !== '') out.details.openDays = Number(answers.openDays)
  }
  if (journey === 'ENTREPRENEUR' && clean(answers.venture)) out.details.venture = clean(answers.venture).slice(0, 200)
  return out
}

export interface CoachWrites {
  coachingStylePreference?: CoachingStylePreference
  changePacePreference?: (typeof CHANGE_PACE_OPTIONS)[number]['value']
  searchIntensity?: SearchIntensity
}

/** O5: tone, pace and (for people out of work and looking) how actively. Blank answers write nothing, so a skip never clears an earlier one. */
export function coachWrites(answers: Answers): CoachWrites {
  const out: CoachWrites = {}
  const style = COACHING_STYLE_OPTIONS.find((o) => o.value === clean(answers.pushStyle))?.value
  if (style) out.coachingStylePreference = style
  const pace = CHANGE_PACE_OPTIONS.find((o) => o.value === clean(answers.pace))?.value
  if (pace) out.changePacePreference = pace
  const intensity = INTENSITY_OPTIONS.find((o) => o.key === clean(answers.intensity))?.key
  if (intensity) out.searchIntensity = intensity
  return out
}

// ── Reading answers back ────────────────────────────────────────────────────

export interface StoredProfile {
  journey?: JourneyType | null
  journeyDetails?: unknown
  lastJobEndedAt?: Date | null
  gapDuration?: string | null
  resumeLatestJobTitle?: string | null
  targetRoleType?: string | null
  primaryFunction?: string | null
  highestLevelReached?: string | null
  currentCity?: string | null
  currentState?: string | null
  remotePreference?: string | null
  openToRelocation?: boolean | null
  onboardingLocationConfirmedAt?: Date | null
  coachingStylePreference?: string | null
  changePacePreference?: string | null
  searchIntensity?: string | null
}

/** The answers a member already gave (or the résumé gave for them), so every bundle opens filled in and can be edited. */
export function storedAnswers(p: StoredProfile): Answers {
  const d = (p.journeyDetails ?? {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
  return {
    situation: p.journey ? JOURNEY_TO_SITUATION[p.journey] : '',
    startTiming: text(d.startTiming),
    applyTiming: text(d.applyTiming),
    moveDriver: text(d.moveDriver),
    returnDate: text(d.returnDate),
    offering: text(d.offering),
    openDays: text(d.openDays),
    venture: text(d.venture),
    gapDuration: p.gapDuration ?? '',
    lastDayWorked: p.lastJobEndedAt ? p.lastJobEndedAt.toISOString().slice(0, 10) : '',
    targetRole: p.targetRoleType ?? p.resumeLatestJobTitle ?? '',
    function: p.primaryFunction ?? '',
    level: p.highestLevelReached ?? '',
    place: [p.currentCity, p.currentState].filter(Boolean).join(', '),
    workSetup: p.remotePreference ?? '',
    // Only a real answer: before the question was asked, the stored false means nothing.
    relocation: p.onboardingLocationConfirmedAt ? (p.openToRelocation ? 'yes' : 'no') : '',
    pushStyle: p.coachingStylePreference ?? '',
    pace: p.changePacePreference ?? '',
    intensity: p.searchIntensity ?? '',
  }
}

/** The profile fields the job matching reads that these answers would change, for the live "how many jobs fit" count. */
export function matchOverrides(bundle: 'aiming' | 'where', answers: Answers): Record<string, unknown> {
  if (bundle === 'aiming') {
    return {
      ...(clean(answers.function) ? { primaryFunction: normalizeFunctionValue(answers.function) } : {}),
      ...(clean(answers.level) ? { highestLevelReached: normalizeLevelValue(answers.level) } : {}),
      ...(clean(answers.targetRole) ? { targetRoleType: clean(answers.targetRole) } : {}),
    }
  }
  const place = parsePlace(answers.place)
  return {
    ...(clean(answers.workSetup) ? { remotePreference: normalizeRemotePreferenceValue(answers.workSetup) } : {}),
    ...(clean(answers.relocation) ? { openToRelocation: answers.relocation === 'yes' } : {}),
    ...(place.city ? { currentCity: place.city } : {}),
    ...(place.state ? { currentState: place.state } : {}),
  }
}
