import { describe, expect, it } from 'vitest'
import { clampCalls, displayName, matchesFilter, mentorHasRoom, parseTags } from '@/lib/higher-ed/mentor-rules'

describe('mentor rules', () => {
  it('clamps calls per month', () => {
    expect(clampCalls(0)).toBe(1)
    expect(clampCalls(3.4)).toBe(3)
    expect(clampCalls(99)).toBe(8)
    expect(clampCalls(NaN)).toBe(2)
  })
  it('parses and de-duplicates tags', () => {
    expect(parseTags('Finance, finance; Health care\nOperations')).toEqual(['Finance', 'Health care', 'Operations'])
    expect(parseTags('')).toEqual([])
    expect(parseTags('a,b,c,d,e,f,g,h')).toHaveLength(6)
    expect(parseTags('x'.repeat(100))[0]).toHaveLength(40)
  })
  it('knows when a mentor is full', () => {
    expect(mentorHasRoom(1, 2)).toBe(true)
    expect(mentorHasRoom(2, 2)).toBe(false)
  })
  it('filters case-insensitively with substrings and empty filters match all', () => {
    const m = { industries: ['Health care'], functions: ['Finance'] }
    expect(matchesFilter(m, 'health', '')).toBe(true)
    expect(matchesFilter(m, '', 'fin')).toBe(true)
    expect(matchesFilter(m, 'energy', '')).toBe(false)
    expect(matchesFilter(m, '', '')).toBe(true)
  })
  it('shows first name and last initial only', () => {
    expect(displayName('Dana', 'Whitfield')).toBe('Dana W.')
    expect(displayName(null, null)).toBe('An alum')
    expect(displayName('Dana', null)).toBe('Dana')
  })
})
