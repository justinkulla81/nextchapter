import { describe, expect, it } from 'vitest'
import { marketLine } from '@/lib/market/market-line'

const base = { open: 40, growth: null, prompt: 'healthy' as const, senior: false }

describe('marketLine', () => {
  it('says advertised roles, never "jobs", and pluralizes', () => {
    expect(marketLine(base).text).toBe('About 40 advertised roles fit you.')
    expect(marketLine({ ...base, open: 1 }).text).toBe('About 1 advertised role fits you.')
  })
  it('names the trend only when it is at least 10%', () => {
    expect(marketLine({ ...base, growth: 0.05 }).text).not.toContain('growing')
    expect(marketLine({ ...base, growth: 0.25 }).text).toContain('growing 25% faster')
    expect(marketLine({ ...base, growth: -0.3, prompt: 'shrinking' }).text).toContain('shrinking, 30% slower')
  })
  it('points a narrow market at widening the search, and a senior one at people', () => {
    expect(marketLine({ ...base, open: 12, prompt: 'too_few' }).step.kind).toBe('expand')
    const senior = marketLine({ ...base, open: 4, prompt: 'too_few', senior: true })
    expect(senior.step.kind).toBe('network')
    expect(senior.why).toContain('filled before they are advertised')
  })
  it('points a shrinking market at skills, and a crowded one at narrowing', () => {
    expect(marketLine({ ...base, prompt: 'shrinking', growth: -0.4 }).step.kind).toBe('learn')
    expect(marketLine({ ...base, open: 900, prompt: 'too_many' }).step.kind).toBe('narrow')
  })
  it('points a healthy market at who to contact', () => {
    expect(marketLine(base).step.kind).toBe('network')
  })
  it('always gives a reason and a destination', () => {
    for (const prompt of ['too_few', 'shrinking', 'too_many', 'healthy'] as const) {
      for (const senior of [true, false]) {
        const l = marketLine({ ...base, prompt, senior })
        expect(l.why.length).toBeGreaterThan(20)
        expect(l.step.href.startsWith('/dashboard/')).toBe(true)
      }
    }
  })
})
