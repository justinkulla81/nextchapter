import { describe, it, expect } from 'vitest'
import { COACHING_STYLES, COACHING_STYLE_ITEMS, scoreCoachingStyle, styleFit, isCoachingStyle } from '@/lib/coach/coaching-style'

const rate = (overrides: Record<string, number>, base = 2) =>
  Object.fromEntries(COACHING_STYLE_ITEMS.map((i) => [i.id, overrides[i.id] ?? base]))

describe('the item bank', () => {
  it('has two statements for each of the six styles', () => {
    for (const s of COACHING_STYLES) expect(COACHING_STYLE_ITEMS.filter((i) => i.style === s)).toHaveLength(2)
    expect(new Set(COACHING_STYLE_ITEMS.map((i) => i.id)).size).toBe(COACHING_STYLE_ITEMS.length)
  })
})

describe('scoreCoachingStyle', () => {
  it('finds what the member wants most, strongest first, at most two', () => {
    const r = scoreCoachingStyle(rate({ 'push-1': 4, 'push-2': 4, 'accountability-1': 4, 'accountability-2': 3, 'support-1': 3, 'support-2': 3 }))
    expect(r.top).toEqual(['PUSH', 'ACCOUNTABILITY'])
    expect(r.scores.PUSH).toBe(4)
  })

  it('reports no preference when everything is rated alike', () => {
    expect(scoreCoachingStyle(rate({}, 3)).top).toEqual([])
    expect(scoreCoachingStyle(rate({}, 1)).top).toEqual([])
  })

  it('only calls a style wanted when it is a real yes, not merely the highest of lukewarm answers', () => {
    expect(scoreCoachingStyle(rate({ 'push-1': 2, 'push-2': 2 }, 1)).top).toEqual([])
  })

  it('ignores invalid answers and handles a partial assessment', () => {
    const r = scoreCoachingStyle({ 'push-1': 4, 'push-2': 9, 'support-1': 0 })
    expect(r.scores.PUSH).toBe(4) // the out-of-range answer is dropped, not averaged in
    expect(r.scores.SUPPORT).toBeNull()
    expect(r.top).toEqual(['PUSH'])
  })

  it('returns nothing for no answers', () => {
    expect(scoreCoachingStyle({}).top).toEqual([])
  })
})

describe('styleFit', () => {
  it('counts how many wanted styles a coach delivers', () => {
    expect(styleFit(['PUSH', 'ACCOUNTABILITY'], ['PUSH', 'ACCOUNTABILITY', 'STRATEGY'])).toEqual({ overlap: 2, matched: ['PUSH', 'ACCOUNTABILITY'] })
    expect(styleFit(['PUSH', 'ACCOUNTABILITY'], ['SUPPORT', 'PUSH'])).toEqual({ overlap: 1, matched: ['PUSH'] })
    expect(styleFit(['PUSH'], [])).toEqual({ overlap: 0, matched: [] })
  })
  it('ignores values that are not styles', () => {
    expect(styleFit(['PUSH'], ['push hard', 'PUSH']).overlap).toBe(1)
    expect(isCoachingStyle('nope')).toBe(false)
  })
})
