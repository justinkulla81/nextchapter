import { describe, expect, it } from 'vitest'
import { projectionFor, projectionLine } from '@/lib/market/occupation-projections'
import { baseTitle, socForTitle, TITLE_SOC_CODES, titleSocDuplicates } from '@/lib/seo/title-soc'

describe('title to occupation allowlist', () => {
  it('every code has BLS projection figures', () => {
    expect(TITLE_SOC_CODES.filter((c) => !projectionFor(c))).toEqual([])
  })
  it('no title sits under two occupations', () => {
    expect(titleSocDuplicates()).toEqual([])
  })
  it('strips level words and maps the near misses the general matcher gets wrong', () => {
    expect(baseTitle('Senior Accountant II')).toBe('accountant')
    expect(socForTitle('Senior Accountant')).toBe('13-2011')
    expect(socForTitle('Staff Software Engineer')).toBe('15-1252')
    expect(socForTitle('Project Manager')).toBe('13-1082')
    expect(socForTitle('Account Executive')).toBe('41-3091')
    expect(socForTitle('Business Development Manager')).toBeNull()
    expect(socForTitle('Product Manager')).toBeNull()
    expect(socForTitle('Chief Nursing Officer')).toBeNull()
  })
  it('words the outlook without promising anything about a person', () => {
    expect(projectionLine(projectionFor('15-1252')!)).toMatch(/^Projected to grow 10% from 2025 to 2035/)
    expect(projectionLine(projectionFor('43-3051')!)).toMatch(/shrink 16%/)
  })
})
