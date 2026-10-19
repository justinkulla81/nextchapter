import { describe, expect, it } from 'vitest'
import { QUICK_QUESTIONS, asButtons, queueQuickQuestions, quickQuestionFor } from '@/lib/search-strategy/quick-questions'
import { SIGNALS, spineGaps } from '@/lib/personalization/spine'

describe('quick questions', () => {
  it('each one maps to a real spine signal and field, so nothing is asked that the spine does not know', () => {
    for (const q of QUICK_QUESTIONS) {
      const signal = SIGNALS.find((s) => s.key === q.key)
      expect(signal, q.key).toBeTruthy()
      expect(signal!.field).toBe(q.field)
    }
  })

  it('accepts only its own options and rejects anything else', () => {
    for (const q of QUICK_QUESTIONS) {
      for (const o of q.options) expect(q.toData(o.value), `${q.key}:${o.value}`).not.toBeNull()
      expect(q.toData('not-an-option'), q.key).toBeNull()
      expect(q.toData(''), q.key).toBeNull()
    }
  })

  it('writes the value each field expects', () => {
    expect(quickQuestionFor('pace')!.toData('CASUALLY_LOOKING')).toEqual({ searchIntensity: 'CASUALLY_LOOKING' })
    expect(quickQuestionFor('application_volume')!.toData('10')).toEqual({ applicationVolumeGoal: 10 })
    expect(quickQuestionFor('comp_floor')!.toData('200')).toEqual({ targetCompMin: 200_000 })
    expect(quickQuestionFor('search_stall_point')!.toData('FINAL_ROUND')).toEqual({ searchStallPoint: 'FINAL_ROUND' })
  })

  it('uses buttons for four options or fewer and a dropdown for more', () => {
    expect(asButtons(quickQuestionFor('pace')!)).toBe(true)
    expect(asButtons(quickQuestionFor('coaching_style')!)).toBe(true)
    expect(asButtons(quickQuestionFor('comp_floor')!)).toBe(false)
    expect(asButtons(quickQuestionFor('search_stall_point')!)).toBe(false)
  })

  it('queues only the spine gaps that have a quick question, in the spine order, with why and gain', () => {
    const gaps = spineGaps('LAID_OFF' as never, 'APPLYING' as never, {})
    const queue = queueQuickQuestions(gaps)
    const keys = queue.map((q) => q.key)
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.every((k) => quickQuestionFor(k))).toBe(true)
    const spineOrder = gaps.map((g) => g.key).filter((k) => keys.includes(k))
    expect(keys).toEqual(spineOrder)
    expect(queue.every((q) => q.question.length > 0 && q.gain.length > 0)).toBe(true)
  })

  it('does not queue what is already answered', () => {
    const gaps = spineGaps('LAID_OFF' as never, 'APPLYING' as never, { searchIntensity: 'ACTIVELY_SEARCHING', networkComfortLevel: 'VERY_COMFORTABLE' })
    const keys = queueQuickQuestions(gaps).map((q) => q.key)
    expect(keys).not.toContain('pace')
    expect(keys).not.toContain('network_comfort')
  })
})
