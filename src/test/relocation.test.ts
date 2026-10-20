import { describe, expect, it } from 'vitest'
import { buildRelocation, opensToMove, parseRelocation, wouldMoveTo } from '@/lib/journey/relocation'

describe('how far will you go', () => {
  it('reads the old yes/no until a scope is saved', () => {
    expect(parseRelocation(null, true)).toEqual({ scope: 'ANYWHERE' })
    expect(parseRelocation({}, false)).toEqual({ scope: 'LOCAL' })
  })
  it('stays local unless they pick places', () => {
    expect(buildRelocation({ scope: 'STATES', states: [] })).toEqual({ scope: 'LOCAL' })
    expect(buildRelocation({ scope: 'STATES', states: ['tx', 'CO', 'tx', 'zzz'] })).toEqual({ scope: 'STATES', states: ['CO', 'TX'] })
    expect(buildRelocation({ scope: 'RADIUS', radiusMiles: 7 })).toEqual({ scope: 'RADIUS', radiusMiles: 50 })
    expect(buildRelocation({ scope: 'nonsense' })).toEqual({ scope: 'LOCAL' })
  })
  it('the old yes/no follows the scope', () => {
    expect(opensToMove({ scope: 'LOCAL' })).toBe(false)
    expect(opensToMove({ scope: 'RADIUS', radiusMiles: 25 })).toBe(true)
  })
  it('would they move to that state', () => {
    const states = { scope: 'STATES' as const, states: ['CO', 'TX'] }
    expect(wouldMoveTo(states, 'CO', 'NY')).toBe(true)
    expect(wouldMoveTo(states, 'FL', 'NY')).toBe(false)
    expect(wouldMoveTo({ scope: 'ANYWHERE' }, 'FL', 'NY')).toBe(true)
    expect(wouldMoveTo({ scope: 'LOCAL' }, 'FL', 'NY')).toBe(false)
    expect(wouldMoveTo({ scope: 'LOCAL' }, 'NY', 'NY')).toBe(true)
    expect(wouldMoveTo({ scope: 'RADIUS', radiusMiles: 100 }, 'NJ', 'NY')).toBe(false)
  })
  it('keeps the saved states through a round trip', () => {
    const saved = buildRelocation({ scope: 'STATES', states: ['TX'] })
    expect(parseRelocation({ relocation: saved }, false)).toEqual(saved)
  })
})
