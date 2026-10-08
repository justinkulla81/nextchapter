import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { nextWarmth, warmthFromConnectionDegree, schoolsFrom, formerEmployerFrom } from '@/lib/crm/background'

describe('warmthFromConnectionDegree', () => {
  it('maps LinkedIn distance to a starting warmth, and nothing to null', () => {
    expect(warmthFromConnectionDegree('1st')).toBe('HOT')
    expect(warmthFromConnectionDegree('2nd')).toBe('WARM')
    expect(warmthFromConnectionDegree('3rd')).toBe('COLD')
    expect(warmthFromConnectionDegree('')).toBeNull()
    expect(warmthFromConnectionDegree(undefined)).toBeNull()
  })
})

describe('nextWarmth', () => {
  it('sets warmth when none was ever set', () => {
    expect(nextWarmth('UNKNOWN', null, '2nd')).toBe('WARM')
  })

  it('raises the extension’s own guess when they accept the invite', () => {
    expect(nextWarmth('WARM', '2nd', '1st')).toBe('HOT')
  })

  it('never overrides a warmth set by hand', () => {
    // Was 2nd (→ WARM), but someone graded them COLD: not the extension's guess.
    expect(nextWarmth('COLD', '2nd', '1st')).toBeNull()
    // No degree was ever recorded, so a non-UNKNOWN warmth is a judgement.
    expect(nextWarmth('WARM', null, '1st')).toBeNull()
  })

  it('never cools anyone down', () => {
    expect(nextWarmth('HOT', '1st', '2nd')).toBeNull()
  })

  it('does nothing without a degree on the page', () => {
    expect(nextWarmth('UNKNOWN', null, '')).toBeNull()
  })
})

describe('schoolsFrom', () => {
  it('keeps real, distinct schools with their degree line', () => {
    expect(schoolsFrom([
      { name: 'Carnegie Mellon University', detail: 'PhD, Robotics' },
      { name: '  Carnegie   Mellon University ', detail: '' },
      { name: 'Self-employed' },
      { name: '' },
      'junk',
    ])).toEqual([{ name: 'Carnegie Mellon University', detail: 'PhD, Robotics' }])
  })

  it('ignores anything that is not a list', () => {
    expect(schoolsFrom(null)).toEqual([])
    expect(schoolsFrom({ name: 'Harvard University' })).toEqual([])
  })

  it('caps the list', () => {
    expect(schoolsFrom(Array.from({ length: 10 }, (_, i) => ({ name: `School ${i} University` })))).toHaveLength(6)
  })
})

describe('formerEmployerFrom', () => {
  it('reads a real employer and drops placeholders', () => {
    expect(formerEmployerFrom({ name: 'Acme Corp', title: 'VP Product' })).toEqual({ name: 'Acme Corp', title: 'VP Product' })
    expect(formerEmployerFrom({ name: 'Unemployed' })).toBeNull()
    expect(formerEmployerFrom(undefined)).toBeNull()
  })
})
