// Pure gating/messaging logic for the calibration loop (Market Reality
// Redesign Part 3). runWeeklyCalibrationCheck itself is Prisma-calling and
// covered by the DB-level scripts/verify-market-reality-calibration.ts
// script instead — same split composite.ts/attempts.ts already use between
// pure math and their DB wrappers. This file locks down the exported
// constants and the messaging function directly.
import { describe, it, expect } from 'vitest'
import {
  MIN_SAMPLE_ATTEMPTS,
  CONSECUTIVE_WEEKS_FOR_BAND_CROSS,
  MIN_AGGREGATE_COHORT_SIZE,
  getCalibrationMessage,
} from '@/lib/scoring/market-reality/calibration'

describe('calibration thresholds', () => {
  it('minimum sample gate is 15 weighted attempts', () => {
    expect(MIN_SAMPLE_ATTEMPTS).toBe(15)
  })

  it('a full band-cross requires 3 consecutive weeks, the low end of the 3-4 estimate', () => {
    expect(CONSECUTIVE_WEEKS_FOR_BAND_CROSS).toBe(3)
  })

  it('aggregate corroboration requires a cohort of at least 5 candidates', () => {
    expect(MIN_AGGREGATE_COHORT_SIZE).toBe(5)
  })
})

describe('getCalibrationMessage', () => {
  it('returns null when no band was actually crossed', () => {
    expect(getCalibrationMessage({ bandCrossed: false, aggregateCorroborated: false }, 'UNDER', 'Product Manager')).toBeNull()
    expect(getCalibrationMessage({ bandCrossed: false, aggregateCorroborated: true }, 'UNDER', 'Product Manager')).toBeNull()
  })

  it('an aggregate-corroborated downward cross blames the market, not the candidate', () => {
    const message = getCalibrationMessage({ bandCrossed: true, aggregateCorroborated: true }, 'UNDER', 'Product Manager')
    expect(message).not.toBeNull()
    expect(message!.body).toContain('job market for Product Manager has gotten tougher')
    expect(message!.body).not.toContain('not the market')
  })

  it('an individual (non-corroborated) downward cross never blames a market shift that is not happening', () => {
    const message = getCalibrationMessage({ bandCrossed: true, aggregateCorroborated: false }, 'UNDER', 'Product Manager')
    expect(message).not.toBeNull()
    expect(message!.body).toContain("isn't the market shifting")
    expect(message!.body).not.toContain('job market for')
  })

  it('an upward cross is always the same warm framing regardless of corroboration', () => {
    const corroborated = getCalibrationMessage({ bandCrossed: true, aggregateCorroborated: true }, 'OVER', 'Product Manager')
    const individual = getCalibrationMessage({ bandCrossed: true, aggregateCorroborated: false }, 'OVER', 'Product Manager')
    expect(corroborated!.body).toBe(individual!.body)
    expect(corroborated!.body).toContain('converting better than we estimated')
  })
})
