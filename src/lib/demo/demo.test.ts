import { describe, expect, it } from 'vitest'
import { makeRng } from './prng'
import { seatMix, sizesFor } from './scenarios'
import { demoEmail, sampleCandidatePrefix } from './people'

describe('makeRng', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng('riverside')
    const b = makeRng('riverside')
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()))
  })
  it('differs between seeds', () => {
    expect(makeRng('a').next()).not.toBe(makeRng('b').next())
  })
  it('stays in range', () => {
    const r = makeRng(7)
    for (let i = 0; i < 200; i++) {
      const n = r.int(3, 9)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(9)
    }
  })
})

describe('scenarios', () => {
  it('defaults to realistic', () => {
    expect(sizesFor(undefined)).toEqual(sizesFor('Realistic'))
    expect(sizesFor('nonsense')).toEqual(sizesFor('Realistic'))
  })
  it('grows from light to large', () => {
    expect(sizesFor('Light').seats).toBeLessThan(sizesFor('Realistic').seats)
    expect(sizesFor('Realistic').seats).toBeLessThan(sizesFor('Large').seats)
  })
  it('splits seats so the parts add up', () => {
    for (const n of [24, 120, 400]) {
      const m = seatMix(n)
      expect(m.active + m.invited + m.ended).toBe(n)
      expect(m.active).toBeGreaterThan(m.invited)
    }
  })
})

describe('people', () => {
  it('uses a reserved test domain that can never receive mail', () => {
    expect(demoEmail('acme', 'coach')).toBe('demo+acme-coach@nextchapter.test')
  })
  it('prefixes sample candidates by organization', () => {
    expect(sampleCandidatePrefix('acme')).toBe('demo-org-acme-')
  })
})
