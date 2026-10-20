import { describe, expect, it } from 'vitest'
import { pValue, sendsNeeded } from '@/lib/outreach/stats'

describe('outreach stats', () => {
  it('finds no difference between equal rates', () => {
    expect(pValue({ sends: 100, hits: 10 }, { sends: 100, hits: 10 })).toBeGreaterThan(0.9)
  })
  it('finds a clear difference between very different rates', () => {
    expect(pValue({ sends: 200, hits: 10 }, { sends: 200, hits: 40 })).toBeLessThan(0.05)
  })
  it('does not call a difference with no sends', () => {
    expect(pValue({ sends: 0, hits: 0 }, { sends: 50, hits: 5 })).toBe(1)
  })
  it('sizes a test: 10% versus 20% needs about 200 per side', () => {
    const n = sendsNeeded(0.1, 0.2)!
    expect(n).toBeGreaterThan(180)
    expect(n).toBeLessThan(220)
    expect(sendsNeeded(0.1, 0.1)).toBeNull()
  })
})
