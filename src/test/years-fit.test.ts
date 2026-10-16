import { describe, expect, it } from 'vitest'
import { assessYearsFit, parseYearsRange, quickYearsRange, yearsTolerance, formatYearsRange } from '@/lib/jobs/years-fit'

const band = (years: number | null, min: number, max: number | null = null, soft = false) => assessYearsFit(years, { min, max, soft }).band

describe('parsing the stated range', () => {
  it('reads a range and an open minimum', () => {
    expect(parseYearsRange('8-15 years of progressive finance experience')).toEqual({ min: 8, max: 15, soft: false })
    expect(parseYearsRange('5+ years of experience in operations')).toEqual({ min: 5, max: null, soft: false })
    expect(quickYearsRange('Requires 8-15 years of finance experience')).toEqual({ min: 8, max: 15 })
    expect(quickYearsRange('8 to 15 years of relevant experience')).toEqual({ min: 8, max: 15 })
    expect(quickYearsRange('5+ years of experience')).toEqual({ min: 5, max: null })
  })
  it('ignores numbers not tied to experience', () => {
    expect(quickYearsRange('Founded 25 years ago in Ohio')).toBeNull()
    expect(parseYearsRange('Founded 25 years ago in Ohio')).toBeNull()
    expect(quickYearsRange(null)).toBeNull()
  })
  it('marks preferred as soft', () => {
    expect(parseYearsRange('5 years of experience preferred')?.soft).toBe(true)
  })
  it('formats', () => {
    expect(formatYearsRange({ min: 8, max: 15 })).toBe('8–15 years')
    expect(formatYearsRange({ min: 5, max: null })).toBe('5+ years')
  })
})

describe('tolerance', () => {
  it('is max(2, 25% of the minimum), +1 when soft', () => {
    expect(yearsTolerance(5)).toBe(2)
    expect(yearsTolerance(8)).toBe(2)
    expect(yearsTolerance(10)).toBe(3)
    expect(yearsTolerance(20)).toBe(5)
    expect(yearsTolerance(8, true)).toBe(3)
  })
})

describe('assessYearsFit', () => {
  it("Justin's examples", () => {
    expect(band(6, 8, 15)).toBe('in_line') // "6 might be alright"
    expect(band(2, 8, 15)).toBe('far') // "not 2 years vs 8-15"
    expect(band(4, 8)).toBe('stretch')
    expect(band(4, 5)).toBe('in_line')
  })
  it('unknown when either side is missing', () => {
    expect(assessYearsFit(null, { min: 5, max: null })).toEqual({ band: 'unknown', short: null, over: null })
    expect(assessYearsFit(5, null).band).toBe('unknown')
  })
  it('stretch runs from just past the tolerance down to half the minimum', () => {
    expect(band(5, 8)).toBe('stretch')
    expect(band(4, 8)).toBe('stretch')
    expect(band(3, 8)).toBe('far')
    expect(band(10, 20)).toBe('stretch')
    expect(band(9, 20)).toBe('far')
    expect(band(15, 20)).toBe('in_line')
  })
  it('soft requirements get a year more', () => {
    expect(band(5, 8, null, true)).toBe('in_line')
    expect(band(5, 8)).toBe('stretch')
  })
  it('reports how short and how far over', () => {
    expect(assessYearsFit(6, { min: 8, max: 15 })).toEqual({ band: 'in_line', short: 2, over: 0 })
    expect(assessYearsFit(18, { min: 8, max: 15 })).toEqual({ band: 'in_line', short: 0, over: 3 })
  })
  it('over the range is fine unless more than about double', () => {
    expect(band(15, 10)).toBe('in_line') // 15 against "10+" is not overqualified
    expect(band(20, 10)).toBe('in_line')
    expect(band(21, 10)).toBe('overqualified')
    expect(band(25, 8, 15)).toBe('in_line')
    expect(band(31, 8, 15)).toBe('overqualified')
    expect(band(9, 2, 4)).toBe('in_line') // more than double, but not min + 8
    expect(band(10, 2, 4)).toBe('overqualified')
  })
})
