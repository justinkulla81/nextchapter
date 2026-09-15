import { describe, it, expect } from 'vitest'
import { describeConnection, humanizeKey, describeVectors } from '@/lib/admin/candidate-progress'

describe('describeConnection', () => {
  const connectedAt = new Date('2026-03-01T00:00:00Z')

  it('reports a never-connected account without inventing a problem', () => {
    const c = describeConnection('Gmail', null)
    expect(c.connected).toBe(false)
    expect(c.problem).toBeNull()
    expect(c.since).toBeNull()
  })

  it('reports a healthy connection', () => {
    const c = describeConnection('Gmail', { connectedAt, disconnectedAt: null, detail: 'x@y.com' })
    expect(c.connected).toBe(true)
    expect(c.detail).toBe('x@y.com')
    expect(c.problem).toBeNull()
  })

  it('treats "needs reconnect" as not connected', () => {
    // This is the state that matters most in support: everything else in the
    // product still shows it as connected while it has silently stopped
    // returning data, so a weekly Gmail drop looks like candidate inactivity.
    const c = describeConnection('Gmail', {
      connectedAt,
      disconnectedAt: null,
      needsReconnectAt: new Date('2026-09-01T00:00:00Z'),
    })
    expect(c.connected).toBe(false)
    expect(c.problem).toContain('2026-09-01')
    // The original connection date is kept — it says how long it worked for.
    expect(c.since).toEqual(connectedAt)
  })

  it('prefers an explicit disconnect over a reconnect prompt', () => {
    const c = describeConnection('Gmail', {
      connectedAt,
      disconnectedAt: new Date('2026-08-01T00:00:00Z'),
      needsReconnectAt: new Date('2026-09-01T00:00:00Z'),
    })
    expect(c.problem).toContain('Disconnected')
  })
})

describe('humanizeKey', () => {
  it('turns stored badge keys into something readable', () => {
    expect(humanizeKey('WEEKLY_SPRINT_TARGET_HIT')).toBe('Weekly Sprint Target Hit')
    expect(humanizeKey('big_five')).toBe('Big Five')
    expect(humanizeKey('KNOWN')).toBe('Known')
  })

  it('survives keys with no separators or stray spacing', () => {
    expect(humanizeKey('known')).toBe('Known')
    expect(humanizeKey('  CLEANED__UP ')).toBe('Cleaned Up')
  })
})

describe('describeVectors', () => {
  it('signs the values so direction is readable', () => {
    expect(describeVectors({ velocity: 2, architecture: -1 })).toBe('Velocity +2.0 · Architecture -1.0')
  })

  it('rounds, because the raw scores carry float noise', () => {
    // Real stored value: -0.9166666666666667 on a -2..+2 scale.
    expect(describeVectors({ velocity: -0.9166666666666667 })).toBe('Velocity -0.9')
  })

  it('returns null rather than an empty string when there is nothing to say', () => {
    expect(describeVectors(null)).toBeNull()
    expect(describeVectors({})).toBeNull()
    expect(describeVectors({ note: 'not a number' })).toBeNull()
  })
})
