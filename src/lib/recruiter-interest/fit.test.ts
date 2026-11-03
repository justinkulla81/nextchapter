import { describe, expect, it } from 'vitest'
import { fitOf, recommend } from './fit'

const firm = { orgId: 'a', industries: ['Financial services'], functions: ['Finance'], seniorities: ['C-suite'], states: ['NY'] }
const cfo = { highestLevel: 'C-Suite', functions: ['Finance'], industries: ['Financial services'], state: 'NY' }

describe('fitOf', () => {
  it('scores function, level and industry', () => {
    const f = fitOf(cfo, firm)
    expect(f.score).toBe(9)
    expect(f.reasons.length).toBe(3)
  })
  it('gives a General firm nothing', () => {
    expect(fitOf(cfo, { industries: [], functions: [], seniorities: ['C-suite'], states: ['NY'] }).score).toBe(0)
  })
  it('does not match a different level and function', () => {
    expect(fitOf({ highestLevel: 'IC', functions: ['Engineering'], industries: [], state: null }, firm).score).toBe(0)
  })
})

describe('recommend', () => {
  it('skips firms already followed and weak matches, best first', () => {
    const weak = { orgId: 'b', industries: ['Healthcare'], functions: ['Operations'], seniorities: ['Manager'], states: [] }
    const mid = { orgId: 'c', industries: ['Healthcare'], functions: ['Finance'], seniorities: ['C-suite'], states: [] }
    const out = recommend(cfo, [weak, mid, firm], new Set())
    expect(out.map((f) => f.orgId)).toEqual(['a', 'c'])
    expect(recommend(cfo, [firm, mid], new Set(['a'])).map((f) => f.orgId)).toEqual(['c'])
  })
})

import { seniorityBand, seniorityBandOfMember } from '@/lib/seo/search-firm-bar'

describe('seniority bands', () => {
  it('groups search levels into the four bands', () => {
    expect(seniorityBand('C_SUITE')).toBe('C-suite')
    expect(seniorityBand('DIRECTOR')).toBe('VP and director')
    expect(seniorityBand('SR_MANAGER')).toBe('Manager')
    expect(seniorityBand('MID_IC')).toBe('Individual contributor')
    expect(seniorityBand('SOMETHING_NEW')).toBeNull()
  })
  it('reads the member level the profile stores', () => {
    expect(seniorityBandOfMember('C-Suite')).toBe('C-suite')
    expect(seniorityBandOfMember('VP')).toBe('VP and director')
    expect(seniorityBandOfMember('Manager')).toBe('Manager')
    expect(seniorityBandOfMember('IC')).toBe('Individual contributor')
    expect(seniorityBandOfMember(null)).toBeNull()
  })
})
