import { describe, expect, it } from 'vitest'
import { humanOpenCount } from '@/lib/mailing/open-human'

describe('humanOpenCount', () => {
  it('is the stored count, which the webhook keeps to human opens', () => expect(humanOpenCount({ openCount: 3 })).toBe(3))
  it('is zero with no open and never negative', () => {
    expect(humanOpenCount({ openCount: 0 })).toBe(0)
    expect(humanOpenCount({ openCount: -1 })).toBe(0)
  })
  it('is zero for an email that bounced, whatever open was recorded', () => {
    expect(humanOpenCount({ openCount: 1, bouncedAt: new Date('2026-11-11T17:10:00Z') })).toBe(0)
    expect(humanOpenCount({ openCount: 2, bouncedAt: null })).toBe(2)
  })
})
