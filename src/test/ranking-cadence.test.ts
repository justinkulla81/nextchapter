import { describe, expect, it } from 'vitest'
import { builtThisMonth, editionFor, editionName, nextEditionDate } from '@/lib/rankings/cadence'

describe('ranking cadence', () => {
  it('builds best places only in a quarter month, other lists every month', () => {
    expect(builtThisMonth('metro', new Date('2026-12-02T06:40:00Z'))).toBe(false)
    expect(builtThisMonth('metro', new Date('2027-01-02T06:40:00Z'))).toBe(true)
    expect(builtThisMonth('places', new Date('2026-12-02T06:40:00Z'))).toBe(true)
  })
  it('rewrites the current quarterly edition when rebuilt between quarters', () => {
    expect(editionFor('metro', new Date('2026-12-10T00:00:00Z'), '2026-11')).toBe('2026-11')
    expect(editionFor('metro', new Date('2027-01-02T00:00:00Z'), '2026-11')).toBe('2027-01')
    expect(editionFor('places', new Date('2026-12-10T00:00:00Z'), '2026-11')).toBe('2026-12')
  })
  it('names quarterly editions by quarter and dates the next one', () => {
    expect(editionName('2027-01', true)).toBe('Q1 2027')
    expect(editionName('2026-11', true)).toBe('November 2026')
    expect(editionName('2026-11', false)).toBe('November 2026')
    expect(nextEditionDate('2026-11', true)).toBe('January 2, 2027')
    expect(nextEditionDate('2027-04', true)).toBe('July 2, 2027')
    expect(nextEditionDate('2026-11', false)).toBe('December 2, 2026')
  })
})
