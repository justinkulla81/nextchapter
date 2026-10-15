import { describe, it, expect } from 'vitest'
import { computeAskRange, marketPositionFor, roundAsk } from '@/lib/in-work/ask-range'

function ok(input: Parameters<typeof computeAskRange>[0]) {
  const r = computeAskRange(input)
  if (!r.ok) throw new Error(r.error)
  return r.range
}

describe('roundAsk', () => {
  it('rounds to $500 under 200k and $1,000 above', () => {
    expect(roundAsk(123_260)).toBe(123_500)
    expect(roundAsk(250_400)).toBe(250_000)
  })
})

describe('marketPositionFor', () => {
  it('is unknown without a usable range', () => {
    expect(marketPositionFor(100_000, null, null)).toBe('unknown')
    expect(marketPositionFor(100_000, 120_000, 110_000)).toBe('unknown')
  })
  it('classifies below, within and above', () => {
    expect(marketPositionFor(90_000, 100_000, 140_000)).toBe('below')
    expect(marketPositionFor(120_000, 100_000, 140_000)).toBe('within')
    expect(marketPositionFor(150_000, 100_000, 140_000)).toBe('above')
  })
})

describe('computeAskRange', () => {
  it('rejects a missing or zero base', () => {
    expect(computeAskRange({ situation: 'RAISE', currentBase: 0 }).ok).toBe(false)
    expect(computeAskRange({ situation: 'RAISE', currentBase: NaN }).ok).toBe(false)
  })

  it('without market data says so and never mentions a market number', () => {
    const r = ok({ situation: 'RAISE', currentBase: 100_000 })
    expect(r.marketPosition).toBe('unknown')
    expect(r.rationale.join(' ')).toMatch(/No market range is available/)
    expect([r.floor, r.target, r.stretch]).toEqual([104_000, 108_000, 112_000])
  })

  it('promotion uses wider steps than a raise', () => {
    const raise = ok({ situation: 'RAISE', currentBase: 100_000 })
    const promo = ok({ situation: 'PROMOTION', currentBase: 100_000 })
    expect(promo.target).toBeGreaterThan(raise.target)
    expect(promo.stretch).toBe(118_000)
  })

  it('below market with a small gap targets the bottom of the range', () => {
    const r = ok({ situation: 'RAISE', currentBase: 100_000, marketLow: 110_000, marketHigh: 150_000 })
    expect(r.marketPosition).toBe('below')
    expect(r.target).toBe(110_000)
    expect(r.stretch).toBe(130_000)
    expect(r.floor).toBeLessThanOrEqual(r.target)
  })

  it('below market with a large gap closes only part of it now', () => {
    const r = ok({ situation: 'RAISE', currentBase: 80_000, marketLow: 120_000, marketHigh: 160_000 })
    expect(r.target).toBe(96_000)
    expect(r.stretch).toBe(120_000)
    expect(r.cautions.join(' ')).toMatch(/different level/)
  })

  it('within the range caps the ask at the top of the range', () => {
    const r = ok({ situation: 'PROMOTION', currentBase: 135_000, marketLow: 100_000, marketHigh: 140_000 })
    expect(r.marketPosition).toBe('within')
    expect(r.target).toBeLessThanOrEqual(140_000)
    expect(r.stretch).toBeLessThanOrEqual(140_000)
    expect(r.cautions.join(' ')).toMatch(/tops out/)
  })

  it('above the range keeps the ask small and points to non-base terms', () => {
    const r = ok({ situation: 'RAISE', currentBase: 160_000, marketLow: 100_000, marketHigh: 140_000 })
    expect(r.marketPosition).toBe('above')
    expect(r.stretch).toBe(169_500)
    expect(r.cautions.join(' ')).toMatch(/title, scope, bonus/)
  })

  it('counter-offer needs the offer and starts at matching it', () => {
    expect(computeAskRange({ situation: 'COUNTER_OFFER', currentBase: 100_000 }).ok).toBe(false)
    const r = ok({ situation: 'COUNTER_OFFER', currentBase: 100_000, competingOfferBase: 130_000 })
    expect(r.floor).toBe(130_000)
    expect(r.target).toBe(134_000)
    expect(r.stretch).toBe(140_500)
    expect(r.cautions.join(' ')).toMatch(/Do not bluff/)
  })

  it('always returns floor <= target <= stretch', () => {
    for (const base of [45_000, 99_999, 210_000]) {
      for (const situation of ['RAISE', 'PROMOTION'] as const) {
        const r = ok({ situation, currentBase: base, marketLow: 90_000, marketHigh: 120_000 })
        expect(r.floor).toBeLessThanOrEqual(r.target)
        expect(r.target).toBeLessThanOrEqual(r.stretch)
      }
    }
  })
})
