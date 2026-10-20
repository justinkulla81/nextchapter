import { describe, it, expect } from 'vitest'
import { countAiShare, mondayOf, sharePct, ALL_FUNCTIONS } from '@/lib/skills/ai-share-snapshot'

describe('countAiShare', () => {
  it('counts per function and for the whole board', () => {
    const rows = countAiShare([
      { fn: 'finance', aiSkillGroups: ['applied'] },
      { fn: 'finance', aiSkillGroups: [] },
      { fn: 'sales', aiSkillGroups: null },
      { fn: null, aiSkillGroups: ['builder'] },
    ])
    expect(rows[0]).toEqual({ fn: ALL_FUNCTIONS, total: 4, withAi: 2 })
    expect(rows.find((r) => r.fn === 'finance')).toEqual({ fn: 'finance', total: 2, withAi: 1 })
    expect(rows.find((r) => r.fn === 'sales')).toEqual({ fn: 'sales', total: 1, withAi: 0 })
    // a posting with no function counts only in 'all'
    expect(rows.map((r) => r.fn)).not.toContain('null')
  })

  it('shares to one decimal and handles an empty board', () => {
    expect(sharePct({ total: 3, withAi: 1 })).toBe(33.3)
    expect(sharePct({ total: 0, withAi: 0 })).toBe(0)
    expect(countAiShare([])).toEqual([])
  })
})

describe('mondayOf', () => {
  it('returns the UTC Monday of the week', () => {
    expect(mondayOf(new Date('2026-10-20T15:00:00Z')).toISOString()).toBe('2026-10-19T00:00:00.000Z') // Tuesday
    expect(mondayOf(new Date('2026-10-19T00:00:00Z')).toISOString()).toBe('2026-10-19T00:00:00.000Z') // Monday
    expect(mondayOf(new Date('2026-10-25T23:59:00Z')).toISOString()).toBe('2026-10-19T00:00:00.000Z') // Sunday
  })
})
