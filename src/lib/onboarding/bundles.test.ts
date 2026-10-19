import { describe, expect, it } from 'vitest'
import { JOURNEYS, type JourneyType } from '@/lib/journey/journey'
import {
  BUNDLE_ORDER,
  MONEY_FIELDS,
  QUESTION_FIELDS,
  answerIsValid,
  bundleQuestions,
  journeyOfSituation,
  nextBundle,
  openRequired,
  validateAnswers,
  type Answers,
  type BundleId,
} from './bundles'
import { coachWrites, gapBucketFromDate, parsePlace, whereYouAreWrites } from './answers'

const JOURNEY_KEYS = JOURNEYS.map((j) => j.key)
const CONTEXTS: (JourneyType | null)[] = [null, ...JOURNEY_KEYS]

describe('bundle shape', () => {
  it('never asks more than three questions at a time, on any journey', () => {
    for (const id of BUNDLE_ORDER) for (const journey of CONTEXTS) expect(bundleQuestions(id, { journey }).length, `${id} / ${journey}`).toBeLessThanOrEqual(3)
  })

  it('asks no money question anywhere in onboarding', () => {
    const money = /\b(pay|salary|wage|runway|savings?|income|money|compensation|severance|equity|afford|\$)\b/i
    for (const id of BUNDLE_ORDER)
      for (const journey of CONTEXTS)
        for (const q of bundleQuestions(id, { journey })) {
          expect(`${q.id} ${q.label} ${q.help ?? ''}`).not.toMatch(money)
          for (const field of QUESTION_FIELDS[q.id]) expect(MONEY_FIELDS).not.toContain(field.split('.')[0])
        }
  })

  it('uses adjacent buttons for two to four options and a dropdown for five or more', () => {
    for (const id of BUNDLE_ORDER)
      for (const journey of CONTEXTS)
        for (const q of bundleQuestions(id, { journey })) {
          if (q.kind === 'choice') expect(q.options!.length, q.id).toBeGreaterThanOrEqual(2)
          if (q.kind === 'choice') expect(q.options!.length, q.id).toBeLessThanOrEqual(4)
          if (q.kind === 'select') expect(q.options!.length, q.id).toBeGreaterThanOrEqual(5)
        }
  })

  it('starts with the situation card alone, then adds the journey follow-up', () => {
    expect(bundleQuestions('where_you_are', { journey: null }).map((q) => q.id)).toEqual(['situation'])
    expect(bundleQuestions('where_you_are', { journey: 'LAID_OFF' }).map((q) => q.id)).toEqual(['situation', 'startTiming', 'lastDayWorked'])
    expect(bundleQuestions('where_you_are', { journey: 'ENTREPRENEUR' }).map((q) => q.id)).toEqual(['situation', 'venture'])
    expect(bundleQuestions('where_you_are', { journey: 'GROWING' }).map((q) => q.id)).toEqual(['situation'])
  })

  it('asks how actively only of people who are out of work and looking', () => {
    const has = (j: JourneyType) => bundleQuestions('coach', { journey: j }).some((q) => q.id === 'intensity')
    expect(has('LAID_OFF')).toBe(true)
    expect(has('RETURNING')).toBe(true)
    expect(has('EXPLORING_MOVE')).toBe(false)
    expect(has('GROWING')).toBe(false)
  })

  it('captures every field the Confirm and Location screens required', () => {
    const required = (id: BundleId) => bundleQuestions(id, { journey: 'PROMOTION' }).filter((q) => q.required).map((q) => q.id)
    expect(required('aiming')).toEqual(['function', 'level'])
    expect(required('where')).toEqual(['workSetup', 'relocation'])
    const written = BUNDLE_ORDER.flatMap((id) => bundleQuestions(id, { journey: 'LAID_OFF' })).flatMap((q) => QUESTION_FIELDS[q.id])
    for (const f of ['primaryFunction', 'highestLevelReached', 'targetRoleType', 'remotePreference', 'openToRelocation', 'onboardingLocationConfirmedAt', 'currentCity', 'currentState'])
      expect(written).toContain(f)
  })

  it('walks the bundles in order', () => {
    expect(nextBundle('where_you_are')).toBe('resume')
    expect(nextBundle('coach')).toBeNull()
  })
})

describe('validation', () => {
  it('names what is missing and what to do, and keeps the member’s other answers', () => {
    const r = validateAnswers('aiming', { journey: null }, { targetRole: 'CFO' })
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(['function', 'level'])
    expect(r.message).toMatch(/to continue/)
    expect(openRequired('aiming', { journey: null }, { function: 'Finance' }).map((q) => q.id)).toEqual(['level'])
  })

  it('accepts a full set and rejects an option that is not on the list', () => {
    expect(validateAnswers('aiming', { journey: null }, { function: 'Finance', level: 'VP' }).ok).toBe(true)
    expect(validateAnswers('aiming', { journey: null }, { function: 'Finance', level: 'Emperor' }).ok).toBe(false)
  })

  it('checks dates and day counts', () => {
    const [, , date] = bundleQuestions('where_you_are', { journey: 'LAID_OFF' })
    expect(answerIsValid(date, '2026-09-30')).toBe(true)
    expect(answerIsValid(date, '30/09/2026')).toBe(false)
    expect(answerIsValid(date, '')).toBe(true)
    const days = bundleQuestions('where_you_are', { journey: 'FRACTIONAL' })[2]
    expect(answerIsValid(days, '4')).toBe(true)
    expect(answerIsValid(days, '9')).toBe(false)
  })

  it('maps a situation card to its journey', () => {
    expect(journeyOfSituation('just_laid_off')).toBe('LAID_OFF')
    expect(journeyOfSituation('nope')).toBeNull()
  })
})

describe('what answers write', () => {
  const now = new Date('2026-10-19T12:00:00Z')

  it('gives employed members a stage and an intensity from when they want to apply', () => {
    const w = whereYouAreWrites('EXPLORING_MOVE', { applyTiming: 'now', moveDriver: 'layoff_worry' }, now)
    expect(w.stage).toBe('APPLYING')
    expect(w.profile.searchIntensity).toBe('ACTIVELY_SEARCHING')
    expect(w.details).toMatchObject({ applyTiming: 'now', moveDriver: 'layoff_worry' })
  })

  it('turns a last day worked into a gap bucket and keeps the date', () => {
    const w = whereYouAreWrites('LAID_OFF', { startTiming: 'after_time_off', lastDayWorked: '2026-06-01' }, now)
    expect(w.stage).toBe('EXPLORING')
    expect(w.profile.gapDuration).toBe('THREE_TO_SIX_MONTHS')
    expect(w.profile.lastJobEndedAt?.toISOString().slice(0, 10)).toBe('2026-06-01')
    expect(gapBucketFromDate('2027-01-01', now)).toBeNull()
  })

  it('stores the journey-specific detail and nothing else', () => {
    expect(whereYouAreWrites('ENTREPRENEUR', { venture: 'A bakery' }, now).details).toEqual({ venture: 'A bakery' })
    expect(whereYouAreWrites('FRACTIONAL', { offering: 'I help X', openDays: '3' }, now).details).toEqual({ offering: 'I help X', openDays: 3 })
    expect(whereYouAreWrites('TIME_OFF', { returnDate: '2027-02-01' }, now).details).toEqual({ returnDate: '2027-02-01' })
    expect(whereYouAreWrites('RETURNING', { gapDuration: 'TWELVE_PLUS_MONTHS' }, now).profile.gapDuration).toBe('TWELVE_PLUS_MONTHS')
    expect(whereYouAreWrites('GROWING', {}, now)).toEqual({ details: {}, profile: {} })
  })

  it('splits a place into city and state', () => {
    expect(parsePlace('Columbus, oh')).toEqual({ city: 'Columbus', state: 'OH' })
    expect(parsePlace('Portland, Oregon')).toEqual({ city: 'Portland', state: 'Oregon' })
    expect(parsePlace('Denver')).toEqual({ city: 'Denver', state: null })
    expect(parsePlace('  ')).toEqual({ city: null, state: null })
  })

  it('writes only what was answered for tone and pace, so a skip never clears an earlier answer', () => {
    const a: Answers = { pushStyle: 'TOUGH_LOVE' }
    expect(coachWrites(a)).toEqual({ coachingStylePreference: 'TOUGH_LOVE' })
    expect(coachWrites({})).toEqual({})
    expect(coachWrites({ intensity: 'CASUALLY_LOOKING', pace: 'BABY_STEPS' })).toEqual({ searchIntensity: 'CASUALLY_LOOKING', changePacePreference: 'BABY_STEPS' })
  })
})
