import { describe, expect, it } from 'vitest'
import { AREAS, answersOf, areaOf, nextStep, withAnswer } from '@/lib/strengths-interview/areas'

const skills = areaOf('skills')!

describe('find your strengths', () => {
  it('has six areas, each with a strength and a starter for every question', () => {
    expect(AREAS).toHaveLength(6)
    for (const a of AREAS) {
      expect(a.questions.some((q) => q.kind === 'strength')).toBe(true)
      for (const q of a.questions) expect(q.starters.length).toBeGreaterThan(0)
    }
  })

  it('asks each question, then its follow-up, then moves on', () => {
    expect(nextStep(skills, [])).toMatchObject({ kind: 'question', question: { key: 'go_to' } })
    const a1 = withAnswer([], { questionKey: 'go_to', question: '', answer: 'Forecasts', followUp: 'Which one?', followUpAnswer: null })
    expect(nextStep(skills, a1)).toMatchObject({ kind: 'followUp', followUp: 'Which one?' })
    const a2 = withAnswer(a1, { ...a1[0], followUpAnswer: '' }) // skipped follow-up
    expect(nextStep(skills, a2)).toMatchObject({ kind: 'question', question: { key: 'weaker' } })
    expect(nextStep(skills, a2, ['weaker'])).toEqual({ kind: 'done' })
  })

  it('keeps answers in question order and drops malformed rows', () => {
    const a = withAnswer(withAnswer([], { questionKey: 'weaker', question: '', answer: 'b' }), { questionKey: 'go_to', question: '', answer: 'a' })
    expect(a.map((x) => x.questionKey)).toEqual(['go_to', 'weaker'])
    expect(answersOf([{ questionKey: 'go_to', answer: 'a' }, { nope: 1 }, null])).toHaveLength(1)
  })
})
