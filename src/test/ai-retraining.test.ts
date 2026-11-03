import { describe, expect, it } from 'vitest'
import { CHECKED_PROGRAMS, ONLINE_PICKS, formatByValue, interestLoc } from '@/lib/learning/ai-retraining'

describe('AI retraining page data', () => {
  it('keeps the state only for in-person and either interest', () => {
    expect(interestLoc('online', 'OH')).toBe('online')
    expect(interestLoc('in-person', 'OH')).toBe('in-person:OH')
    expect(interestLoc('either', '')).toBe('either')
  })
  it('accepts only the three formats', () => {
    expect(formatByValue('either')).toBe('either')
    expect(formatByValue('hybrid')).toBeNull()
  })
  it('matches the exact AI For Everyone title only', () => {
    const p = ONLINE_PICKS.find((x) => x.match.test('AI For Everyone'))
    expect(p?.grade).toBe('B')
    expect(ONLINE_PICKS.some((x) => x.match.test('AI for Everyone: Master the Basics'))).toBe(false)
  })
  it('matches the reviewed course titles and lists every checked program with a program page', () => {
    expect(ONLINE_PICKS.find((p) => p.match.test('Google AI Essentials'))?.grade).toBe('A')
    expect(ONLINE_PICKS.some((p) => p.match.test('Deep Learning Specialization'))).toBe(false)
    for (const p of CHECKED_PROGRAMS) expect(p.url.startsWith('https://')).toBe(true)
    expect(new Set(CHECKED_PROGRAMS.map((p) => p.id)).size).toBe(CHECKED_PROGRAMS.length)
  })
})
