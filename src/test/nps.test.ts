// NPS arithmetic and the rules for when to ask. The score is percent promoters
// minus percent detractors, and the prompt must not nag: not in the first two
// weeks, a quarter after an answer, a month after "Not now".
import { describe, it, expect } from 'vitest'
import { isNpsDue, isValidNpsScore, npsCategory, summarizeNps } from '@/lib/nps/score'

const day = 24 * 60 * 60 * 1000
const now = new Date('2026-10-24T12:00:00Z')
const ago = (days: number) => new Date(now.getTime() - days * day)

describe('npsCategory', () => {
  it.each([[10, 'promoter'], [9, 'promoter'], [8, 'passive'], [7, 'passive'], [6, 'detractor'], [0, 'detractor']] as const)('%i is a %s', (n, c) => expect(npsCategory(n)).toBe(c))
})

describe('isValidNpsScore', () => {
  it.each([0, 5, 10])('accepts %i', (n) => expect(isValidNpsScore(n)).toBe(true))
  it.each([-1, 11, 7.5, NaN, '8', null, undefined])('rejects %s', (n) => expect(isValidNpsScore(n)).toBe(false))
})

describe('summarizeNps', () => {
  it('has no score without answers', () => expect(summarizeNps([])).toEqual({ responses: 0, promoters: 0, passives: 0, detractors: 0, nps: null }))
  it('is percent promoters minus percent detractors', () => {
    // 5 promoters, 3 passives, 2 detractors of 10 -> 50% - 20% = 30
    expect(summarizeNps([10, 10, 9, 9, 9, 8, 7, 7, 6, 0])).toEqual({ responses: 10, promoters: 5, passives: 3, detractors: 2, nps: 30 })
  })
  it('is -100 when everyone is a detractor and 100 when everyone is a promoter', () => {
    expect(summarizeNps([0, 3, 6]).nps).toBe(-100)
    expect(summarizeNps([9, 10]).nps).toBe(100)
  })
  it('rounds to a whole number', () => expect(summarizeNps([10, 8, 8]).nps).toBe(33))
})

describe('isNpsDue', () => {
  it('waits out the first two weeks', () => {
    expect(isNpsDue({ now, since: ago(13), last: null })).toBe(false)
    expect(isNpsDue({ now, since: ago(14), last: null })).toBe(true)
  })
  it('asks someone who was never asked', () => expect(isNpsDue({ now, since: ago(200), last: null })).toBe(true))
  it('waits 90 days after an answer', () => {
    expect(isNpsDue({ now, since: ago(400), last: { score: 9, createdAt: ago(89) } })).toBe(false)
    expect(isNpsDue({ now, since: ago(400), last: { score: 9, createdAt: ago(90) } })).toBe(true)
  })
  it('waits 30 days after "Not now"', () => {
    expect(isNpsDue({ now, since: ago(400), last: { score: null, createdAt: ago(29) } })).toBe(false)
    expect(isNpsDue({ now, since: ago(400), last: { score: null, createdAt: ago(30) } })).toBe(true)
  })
  it('treats a score of 0 as an answer, not a dismissal', () =>
    expect(isNpsDue({ now, since: ago(400), last: { score: 0, createdAt: ago(40) } })).toBe(false))
})
