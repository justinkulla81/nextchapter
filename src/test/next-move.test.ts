import { describe, expect, it } from 'vitest'
import { nextMove } from '@/lib/market/next-move'

const tune = (pct: number) => ({ pct, asks: [{ ask: 'Add your city.', gain: "We'd check commute on 197 matches." }] })

describe('nextMove', () => {
  it('a healthy market says stay the course, with the count', () => {
    const m = nextMove({ market: { open: 163, growth: 0, prompt: 'healthy', senior: true }, tune: tune(90) })!
    expect(m.kind).toBe('stay')
    expect(m.text).toContain("You're in a good pool")
    expect(m.text).toContain('163')
  })
  it('too few roles below senior level means consider a pivot', () => {
    expect(nextMove({ market: { open: 12, growth: null, prompt: 'too_few', senior: false }, tune: tune(90) })!.kind).toBe('pivot')
  })
  it('too few at a senior level is normal: work the network, not a pivot', () => {
    expect(nextMove({ market: { open: 6, growth: null, prompt: 'too_few', senior: true }, tune: tune(90) })!.kind).toBe('network')
  })
  it('a shrinking field means add a skill, even with a thin profile', () => {
    expect(nextMove({ market: { open: 80, growth: -0.4, prompt: 'shrinking', senior: false }, tune: tune(40) })!.kind).toBe('learn')
  })
  it('a thin profile comes before staying the course', () => {
    const m = nextMove({ market: { open: 163, growth: 0, prompt: 'healthy', senior: true }, tune: tune(55) })!
    expect(m.kind).toBe('profile')
    expect(m.text).toBe('Your matches are 55% tuned.')
    expect(m.why).toContain("Add your city: we'd check commute")
  })
  it('no market data: the profile if it needs work, else nothing', () => {
    expect(nextMove({ market: null, tune: tune(55) })!.kind).toBe('profile')
    expect(nextMove({ market: null, tune: tune(95) })).toBeNull()
  })
})
