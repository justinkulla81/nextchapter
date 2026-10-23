import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseInterestQuestions } from '@/lib/onet/interest-profiler'
import { interestBonus, TOP_INTEREST_POINTS, OTHER_TOP_INTEREST_POINTS } from '@/lib/work-interests/job-interest-fit'
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

describe('interestBonus', () => {
  it('rewards a job whose function draws on the member’s top area, most for #1', () => {
    expect(interestBonus(['INVESTIGATIVE', 'SOCIAL', 'ARTISTIC'], ['engineering'])).toBe(TOP_INTEREST_POINTS)
    expect(interestBonus(['SOCIAL', 'INVESTIGATIVE', 'ARTISTIC'], ['engineering'])).toBe(OTHER_TOP_INTEREST_POINTS)
  })

  it('is zero without the assessment, an unmapped function, or no overlap', () => {
    expect(interestBonus([], ['engineering'])).toBe(0)
    expect(interestBonus(['SOCIAL'], ['general'])).toBe(0)
    expect(interestBonus(['ARTISTIC', 'SOCIAL', 'REALISTIC'], ['finance'])).toBe(0)
  })
})

describe('parseInterestQuestions', () => {
  it('parses a real O*NET Interest Profiler response (mnm/interestprofiler/questions, 60 items)', () => {
    const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/onet-interest-questions.json'), 'utf8'))
    const parsed = parseInterestQuestions(fixture)
    expect(parsed).toHaveLength(60)
    expect(parsed[0]).toMatchObject({ index: 1, area: 'REALISTIC' })
    expect(parsed[59]).toMatchObject({ index: 60, area: 'CONVENTIONAL' })
  })
})
