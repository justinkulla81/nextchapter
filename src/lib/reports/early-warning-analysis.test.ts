import { describe, expect, it } from 'vitest'
import { leadLag, movingAverage3, pearson, verdictFor, yearOverYear, type Series } from './early-warning-analysis'

const months = (start: number, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const t = start * 12 + i
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
  })

describe('movingAverage3', () => {
  it('skips a missing calendar month instead of shifting the window', () => {
    const s: Series = new Map([['2025-09', 3], ['2025-11', 5], ['2025-12', 7]])
    const ma = movingAverage3(s)
    expect(ma.get('2025-11')).toBe(4) // Sept and Nov only; Oct was not collected
    expect(ma.get('2025-12')).toBe(6) // Nov and Dec
    expect(ma.has('2025-09')).toBe(false) // only one month available
  })
})

describe('yearOverYear', () => {
  it('subtracts the same month a year earlier and drops months with no prior', () => {
    const s: Series = new Map([['2024-03', 4], ['2025-03', 5.5], ['2025-04', 9]])
    const y = yearOverYear(s)
    expect(y.get('2025-03')).toBe(1.5)
    expect(y.has('2025-04')).toBe(false)
  })
})

describe('pearson', () => {
  it('returns null for short or constant series', () => {
    expect(pearson([1, 2, 3], [1, 2, 3])).toBeNull()
    expect(pearson(Array(20).fill(1), Array.from({ length: 20 }, (_, i) => i))).toBeNull()
  })
})

describe('leadLag', () => {
  // The target repeats the candidate four months later, so lag 4 must win.
  const ms = months(2015, 80)
  const base = ms.map((_, i) => Math.sin(i / 3) + (i % 7) / 10)
  const candidate: Series = new Map(ms.map((m, i) => [m, base[i]]))
  const target: Series = new Map(ms.map((m, i) => [m, i >= 4 ? base[i - 4] : 0]))

  it('finds the lag at which the candidate leads', () => {
    const ll = leadLag(candidate, target)
    expect(ll.best?.lag).toBe(4)
    expect(ll.best!.r).toBeGreaterThan(0.95)
    expect(verdictFor(ll)).toBe('leads')
  })

  it('does not call a same-month mover a leader', () => {
    const ll = leadLag(candidate, candidate)
    expect(ll.best?.lag).toBe(0)
    expect(verdictFor(ll)).toBe('moves-with')
  })

  it('drops pairs that touch the excluded window', () => {
    const spiked: Series = new Map(candidate)
    for (const m of months(2018, 6)) spiked.set(m, 50) // huge shock that would dominate r
    const withShock = leadLag(spiked, spiked, 0)
    const without = leadLag(spiked, spiked, 0, ['2018-01', '2018-06'])
    expect(without.byLag[0].n).toBe(withShock.byLag[0].n - 6)
  })

  it('is unclear for unrelated noise', () => {
    const noise: Series = new Map(ms.map((m, i) => [m, ((i * 7919) % 13) - 6]))
    expect(['unclear', 'moves-with']).toContain(verdictFor(leadLag(candidate, noise)))
  })
})
