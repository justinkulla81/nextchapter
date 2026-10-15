import { describe, expect, it } from 'vitest'
import { INTEREST_AREA_ORDER, scoreInterests, type InterestQuestion } from '@/lib/work-interests/areas'

const questions: InterestQuestion[] = Array.from({ length: 60 }, (_, i) => ({
  index: i + 1,
  area: INTEREST_AREA_ORDER[i % 6],
  text: `Question ${i + 1}`,
}))

describe('scoreInterests', () => {
  it('sums per area and returns the top three, ties in RIASEC order', () => {
    // Social (i % 6 === 3) all 5s, Artistic all 4s, rest all 1s.
    const answers = questions.map((q) => ({
      index: q.index,
      answer: q.area === 'SOCIAL' ? 5 : q.area === 'ARTISTIC' ? 4 : 1,
    }))
    const result = scoreInterests(questions, answers)
    expect(result?.scores.SOCIAL).toBe(50)
    expect(result?.scores.ARTISTIC).toBe(40)
    expect(result?.topAreas).toEqual(['SOCIAL', 'ARTISTIC', 'REALISTIC'])
  })

  it('returns null when an answer is missing or out of range', () => {
    const all = questions.map((q) => ({ index: q.index, answer: 3 }))
    expect(scoreInterests(questions, all.slice(1))).toBeNull()
    expect(scoreInterests(questions, [{ index: 1, answer: 6 }, ...all.slice(1)])).toBeNull()
  })
})
