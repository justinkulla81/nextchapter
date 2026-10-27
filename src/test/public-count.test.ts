import { describe, expect, it } from 'vitest'
import { PUBLIC_COUNT_FLOOR, peopleWord, publicCount } from '@/lib/affiliations/public-count-rules'
import { KIT_MIN_COUNT } from '@/lib/cohorts/launch-kit'

describe('public counts', () => {
  it('uses the same floor as the layoff-cohort launch kit', () => {
    expect(PUBLIC_COUNT_FLOOR).toBe(KIT_MIN_COUNT)
  })
  it('shows nothing under the floor, including zero, and the number at or over it', () => {
    expect(publicCount(0)).toBeNull()
    expect(publicCount(1)).toBeNull()
    expect(publicCount(9)).toBeNull()
    expect(publicCount(10)).toBe(10)
    expect(publicCount(212)).toBe(212)
  })
  it('never shows a missing or bad value', () => {
    expect(publicCount(null)).toBeNull()
    expect(publicCount(undefined)).toBeNull()
    expect(publicCount(Number.NaN)).toBeNull()
    expect(publicCount(Number.POSITIVE_INFINITY)).toBeNull()
  })
  it('words a count', () => {
    expect(peopleWord(1)).toBe('person')
    expect(peopleWord(12)).toBe('people')
  })
})
