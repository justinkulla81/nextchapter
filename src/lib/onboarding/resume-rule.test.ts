import { describe, expect, it } from 'vitest'
import { MARKET_REALITY_ENTRY, entryFromGoalParam, entryOf } from './resume-rule'

describe('the Market Reality marker', () => {
  it('reads only the exact goal value from the link', () => {
    expect(entryFromGoalParam('market-reality')).toBe(MARKET_REALITY_ENTRY)
    expect(entryFromGoalParam('Market-Reality')).toBeNull()
    expect(entryFromGoalParam('')).toBeNull()
    expect(entryFromGoalParam(null)).toBeNull()
    expect(entryFromGoalParam(undefined)).toBeNull()
  })

  it('finds the marker in journeyDetails and ignores anything else', () => {
    expect(entryOf({ entry: 'market_reality', other: 1 })).toBe(MARKET_REALITY_ENTRY)
    expect(entryOf({ entry: 'something_else' })).toBeNull()
    expect(entryOf({})).toBeNull()
    expect(entryOf(null)).toBeNull()
    expect(entryOf('x')).toBeNull()
  })
})
