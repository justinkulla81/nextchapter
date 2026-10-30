import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { GENERAL_PER_RUN, rotateGeneral, weeklyDataPrompts, isDataKey } from '@/lib/ai-visibility/prompts-data'

const NOW = Date.parse('2026-10-30T12:00:00Z')
const day = 86_400_000
const n = (slug: string, state: string, workers: number | null, daysAgo: number, employer = slug) => ({ id: `${slug}${daysAgo}`, state, employer, slug, workers, noticeDate: new Date(NOW - daysAgo * day).toISOString(), bucket: null, companyId: null })

describe('weeklyDataPrompts', () => {
  it('asks about the largest employers and busiest states filed this week, plus two fixed questions', () => {
    const notices = [n('big-co', 'TX', 900, 1, 'Big Co'), n('small-co', 'TX', 50, 2, 'Small Co'), n('old-co', 'CA', 5000, 20, 'Old Co'), n('big-co', 'TX', 100, 3, 'Big Co')]
    const prompts = weeklyDataPrompts(notices, NOW)
    expect(prompts[0]).toEqual({ key: 'data:employer:big-co', prompt: 'Is Big Co laying off employees, and what do the WARN notices say?' })
    expect(prompts.some((p) => p.key === 'data:employer:old-co')).toBe(false)
    expect(prompts.find((p) => p.key === 'data:state:TX')?.prompt).toContain('Texas')
    expect(prompts.map((p) => p.key)).toEqual(expect.arrayContaining(['data:white-collar', 'data:warn-week']))
    expect(prompts.every((p) => isDataKey(p.key))).toBe(true)
  })
  it('still asks the two fixed questions in a quiet week', () => {
    expect(weeklyDataPrompts([], NOW).map((p) => p.key)).toEqual(['data:white-collar', 'data:warn-week'])
  })
})

describe('rotateGeneral', () => {
  const all = Array.from({ length: 30 }, (_, i) => i)
  it('asks 20 of the 30 each week and covers every question over two weeks', () => {
    const a = rotateGeneral(all, 0)
    const b = rotateGeneral(all, 1)
    expect(a).toHaveLength(GENERAL_PER_RUN)
    expect(new Set([...a, ...b]).size).toBe(30)
  })
  it('asks everything when the list is short', () => {
    expect(rotateGeneral([1, 2, 3], 5)).toEqual([1, 2, 3])
  })
})
