import { describe, expect, it } from 'vitest'
import { predictWindows, remindMonth, windowSentence } from './windows'

const d = (s: string) => new Date(`${s}T00:00:00Z`)

describe('predictWindows', () => {
  it('needs two years before calling it a pattern', () => {
    expect(predictWindows([{ type: 'CALL_FOR_SPEAKERS', opensAt: d('2026-02-03'), deadline: d('2026-04-01') }])).toEqual([])
  })
  it('finds the usual opening and closing month', () => {
    const w = predictWindows([
      { type: 'CALL_FOR_SPEAKERS', opensAt: d('2025-02-03'), deadline: d('2025-04-01') },
      { type: 'CALL_FOR_SPEAKERS', opensAt: d('2026-02-10'), deadline: d('2026-04-15') },
      { type: 'AWARD', opensAt: null, deadline: d('2026-06-01') },
    ])
    expect(w).toEqual([{ type: 'CALL_FOR_SPEAKERS', opensMonth: 1, deadlineMonth: 3, years: 2 }])
    expect(windowSentence('Speaker calls', w[0])).toBe('Speaker calls usually open in February (2 years of history).')
    expect(remindMonth(w[0])).toBe(0) // remind in January
  })
})
