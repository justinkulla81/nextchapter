import { describe, it, expect } from 'vitest'
import { buildTitleIndex, normalizeTitle, titleToOccupation, titleVariants } from '@/lib/occupations/title-to-soc'
import { isTargetOccupation, toSocCode } from '@/lib/occupations/target-occupations'
import { ALL_OCCUPATIONS, ALT_TITLES } from './fixtures/occupations-sample'

const index = buildTitleIndex(ALL_OCCUPATIONS, ALT_TITLES)
const soc = (title: string) => titleToOccupation(title, index)?.socCode ?? null

describe('isTargetOccupation / toSocCode', () => {
  it('keeps professional and management occupations at Job Zone 4 and up', () => {
    expect(isTargetOccupation('11-2021', 4)).toBe(true)
    expect(isTargetOccupation('15-2051', 5)).toBe(true)
    expect(isTargetOccupation('27-1024', 4)).toBe(true)
  })
  it('drops low Job Zones, other groups, and an unknown Job Zone', () => {
    expect(isTargetOccupation('11-9051', 3)).toBe(false)
    expect(isTargetOccupation('43-6014', 4)).toBe(false)
    expect(isTargetOccupation('27-2011', 4)).toBe(false) // actors: 27-2, not in scope
    expect(isTargetOccupation('15-1252', null)).toBe(false)
  })
  it('reads O*NET-SOC and plain SOC codes', () => {
    expect(toSocCode('11-2021.00')).toBe('11-2021')
    expect(toSocCode('112021')).toBe('11-2021')
    expect(toSocCode('nope')).toBeNull()
  })
  it('marks the fixture occupations accordingly', () => {
    const inScope = ALL_OCCUPATIONS.filter((o) => o.isTarget).map((o) => o.title)
    expect(inScope).not.toContain('Food Service Managers')
    expect(inScope).not.toContain('Secretaries and Administrative Assistants')
    expect(inScope).toContain('Data Scientists')
  })
})

describe('normalizeTitle / titleVariants', () => {
  it('lowercases, drops punctuation and parentheticals', () => {
    expect(normalizeTitle('Sr. Marketing Managers (EMEA) & Business')).toBe('sr marketing manager and business')
  })
  it('strips level words and expands rank-plus-function titles', () => {
    expect(titleVariants('Senior Marketing Manager')).toContain('marketing manager')
    expect(titleVariants('VP of Marketing')).toEqual(expect.arrayContaining(['marketing manager', 'marketing director']))
    expect(titleVariants('')).toEqual([])
  })
})

describe('titleToOccupation', () => {
  it('matches an occupation title or alternate title exactly', () => {
    expect(soc('Marketing Managers')).toBe('11-2021')
    expect(soc('Marketing Manager')).toBe('11-2021') // O*NET titles are plural
    expect(soc('Controller')).toBe('11-3031')
    expect(titleToOccupation('Controller', index)?.confidence).toBe('exact')
  })
  it('ignores level words', () => {
    expect(soc('Senior Marketing Research Analyst')).toBe('13-1161')
    expect(soc('Principal Machine Learning Scientist')).toBe('15-2051')
  })
  it('reads rank-plus-function titles as the function manager or director', () => {
    expect(soc('VP Marketing')).toBe('11-2021')
    expect(soc('Head of Sales')).toBe('11-2022')
    expect(soc('Senior Director, Finance')).toBe('11-3031')
    expect(soc('Vice President of Human Resources')).toBe('11-3121')
  })
  it('falls back to a close token match when it is unambiguous', () => {
    const m = titleToOccupation('Marketing Research Analyst, Healthcare', index)
    expect(m?.socCode).toBe('13-1161')
    expect(m?.confidence).toBe('fuzzy')
  })
  it('returns null for a title two occupations both list', () => {
    expect(soc('Business Analyst')).toBeNull()
  })
  it('returns null for a title it cannot place', () => {
    expect(soc('Chief Happiness Officer')).toBeNull()
    expect(soc('Analyst')).toBeNull()
    expect(soc('')).toBeNull()
  })
})
