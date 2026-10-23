import { describe, expect, it } from 'vitest'
import { aggregateStats, bestAreas, marketPrompt, MARKET_TOO_FEW, MARKET_TOO_MANY, relativeGrowth, sumCounts, tooFewFor, type StatInput } from '@/lib/market/market-size'

const now = new Date('2026-10-16T00:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)
const row = (over: Partial<StatInput>): StatInput => ({
  title: 'Supply Chain Manager', fn: 'Operations', subFunction: 'ops_supply_chain', level: 'DIRECTOR', industryBucket: 'Healthcare',
  location: 'Austin, TX', locationState: null, workArrangement: null, postedAt: null, createdAt: daysAgo(3), archivedAt: null, closeReason: null, ...over,
})

describe('market-size stats', () => {
  it('counts open, new and closed by window, per target and in a board total', () => {
    const stats = aggregateStats(
      [row({}), row({ createdAt: daysAgo(20) }), row({ archivedAt: daysAgo(2), closeReason: 'removed', createdAt: daysAgo(30) }), row({ archivedAt: daysAgo(2), closeReason: 'duplicate' }), row({ workArrangement: 'remote' })],
      now
    )
    const tx = stats.find((s) => s.geo === 'TX' && s.fn === 'Operations')!
    expect(tx).toMatchObject({ subFunction: 'ops_supply_chain', band: 'DIRECTOR', industry: 'Healthcare', openNow: 2, newRecent: 2, newPrior: 2, closedRecent: 1 })
    expect(stats.find((s) => s.geo === 'remote')!.openNow).toBe(1)
    expect(stats.find((s) => s.fn === '*')!.openNow).toBe(3)
  })
  it('reads growth against the whole board, so crawler growth everywhere is not "growth"', () => {
    const board = { openNow: 1000, newRecent: 1000, newPrior: 1000, closedRecent: 0, closedPrior: 0 }
    expect(relativeGrowth({ openNow: 50, newRecent: 50, newPrior: 50, closedRecent: 0, closedPrior: 0 }, board)).toBeCloseTo(0, 1) // same share as the board: no growth
    expect(relativeGrowth({ openNow: 50, newRecent: 50, newPrior: 25, closedRecent: 0, closedPrior: 0 }, board)!).toBeGreaterThan(0.8)
    expect(relativeGrowth({ openNow: 50, newRecent: 10, newPrior: 80, closedRecent: 0, closedPrior: 0 }, board)!).toBeLessThan(-0.25)
    expect(relativeGrowth({ openNow: 5, newRecent: 2, newPrior: 3, closedRecent: 0, closedPrior: 0 }, board)).toBeNull()
  })
  it('prompts: too few, shrinking, too many, healthy', () => {
    expect(marketPrompt(MARKET_TOO_FEW - 1, 0.5)).toBe('too_few')
    expect(marketPrompt(100, -0.4)).toBe('shrinking')
    expect(marketPrompt(MARKET_TOO_MANY + 1, 0)).toBe('too_many')
    expect(marketPrompt(100, 0)).toBe('healthy')
  })
  it('names the nearby areas with the most room, growing ones first among close counts', () => {
    const areas = bestAreas([
      { kind: 'industry', label: 'A', openNow: 100, growth: -0.4 },
      { kind: 'industry', label: 'B', openNow: 90, growth: 0.5 },
      { kind: 'industry', label: 'C', openNow: 5, growth: 1 },
    ])
    expect(areas.map((a) => a.label)).toEqual(['B', 'A'])
    expect(sumCounts([]).openNow).toBe(0)
  })
})

describe('the too-few line by level', () => {
  it('is lower at the top, where there are few roles in any field', () => {
    expect(tooFewFor(['MID'])).toBe(MARKET_TOO_FEW)
    expect(tooFewFor(['DIRECTOR'])).toBeLessThan(MARKET_TOO_FEW)
    expect(tooFewFor(['VP', 'EXECUTIVE'])).toBeLessThan(tooFewFor(['DIRECTOR']))
  })
  it('lets 20 executive roles read as healthy where 20 mid-level roles are too few', () => {
    expect(marketPrompt(20, null, tooFewFor(['EXECUTIVE']))).toBe('healthy')
    expect(marketPrompt(20, null, tooFewFor(['MID']))).toBe('too_few')
    expect(marketPrompt(5, null, tooFewFor(['EXECUTIVE']))).toBe('too_few')
  })
})
