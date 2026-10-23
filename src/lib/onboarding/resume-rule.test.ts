import { describe, expect, it } from 'vitest'
import { JOURNEYS, type JourneyType } from '@/lib/journey/journey'
import { MARKET_REALITY_ENTRY, entryFromGoalParam, entryOf, resumeRequired } from './resume-rule'

describe('resumeRequired', () => {
  it('requires a résumé from people out of work and looking', () => {
    for (const journey of ['LAID_OFF', 'RETURNING', 'STUDENT_NEW_GRAD'] as JourneyType[]) {
      expect(resumeRequired({ journey }), journey).toBe(true)
    }
  })

  it('lets everyone else skip it', () => {
    for (const journey of ['EXPLORING_MOVE', 'PROMOTION', 'CAREER_CHANGE', 'NEXT_ACT', 'GROWING', 'FRACTIONAL', 'ENTREPRENEUR', 'TIME_OFF'] as JourneyType[]) {
      expect(resumeRequired({ journey }), journey).toBe(false)
    }
  })

  it('always requires it for a Market Reality arrival, whatever their journey', () => {
    for (const journey of ['EXPLORING_MOVE', 'GROWING', 'TIME_OFF'] as JourneyType[]) {
      expect(resumeRequired({ journey, entry: MARKET_REALITY_ENTRY }), journey).toBe(true)
    }
  })

  it('places every journey by its own flags, so a new journey needs no edit here', () => {
    for (const j of JOURNEYS) {
      expect(resumeRequired({ journey: j.key }), j.key).toBe(!j.employed && j.searching)
    }
  })

  it('keeps the original rule (required) when the journey is not known yet', () => {
    expect(resumeRequired({ journey: null })).toBe(true)
  })
})

describe('the Market Reality marker', () => {
  it('reads only the exact goal value from the link', () => {
    expect(entryFromGoalParam('market-reality')).toBe(MARKET_REALITY_ENTRY)
    expect(entryFromGoalParam('Market-Reality')).toBeNull()
    expect(entryFromGoalParam('')).toBeNull()
    expect(entryFromGoalParam(null)).toBeNull()
    expect(entryFromGoalParam(undefined)).toBeNull()
  })

  it('finds the marker in journeyDetails and ignores anything else', () => {
    expect(entryOf({ entry: 'market_reality', other: 1 })).toBe(MARKET_REALITY_ENTRY)
    expect(entryOf({ entry: 'something_else' })).toBeNull()
    expect(entryOf({})).toBeNull()
    expect(entryOf(null)).toBeNull()
    expect(entryOf('x')).toBeNull()
  })
})
