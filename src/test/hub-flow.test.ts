import { describe, expect, it } from 'vitest'
import { cell, fundingOutcomes, matchPercent, responseOutcomes } from '@/lib/workforce/hub-flow'

describe('hub flow helpers', () => {
  const responses = [
    { id: 'r1', employer: 'A Co', seats: 80, fundingApplicationId: 'f1', stepsDone: 4 },
    { id: 'r2', employer: 'B Co', seats: 40, fundingApplicationId: null, stepsDone: 1 },
  ]
  const people = [
    ...Array.from({ length: 10 }, (_, i) => ({ rapidResponseId: 'r1', joined: i < 8, landed: i < 3 })),
    { rapidResponseId: 'r2', joined: true, landed: false },
    { rapidResponseId: null, joined: true, landed: true },
  ]
  it('counts signed up, joined and landed per response', () => {
    const o = responseOutcomes(responses, people)
    expect(o[0]).toMatchObject({ signedUp: 10, joined: 8, landed: 3, stepsDone: 4 })
    expect(o[1]).toMatchObject({ signedUp: 1, joined: 1, landed: 0 })
  })
  it('rolls results up to the funding that pays for a response', () => {
    const f = fundingOutcomes([{ id: 'f1', name: 'Reserve', funder: null, status: 'AWARDED', amountAwarded: 50000, matchRequired: null, matchCommitted: null }], responseOutcomes(responses, people))
    expect(f[0]).toMatchObject({ responses: 1, signedUp: 10, landed: 3 })
  })
  it('hides counts under five', () => {
    expect(cell(0)).toBe('0')
    expect(cell(3)).toBe('<5')
    expect(cell(1200)).toBe('1,200')
  })
  it('match percent is capped and null without a requirement', () => {
    expect(matchPercent(100, 25)).toBe(25)
    expect(matchPercent(100, 250)).toBe(100)
    expect(matchPercent(null, 10)).toBeNull()
  })
})
