import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

describe('changing journey changes the plan and keeps what you did', async () => {
  const { mergeRebuiltPlan } = await import('@/lib/weekly/sprint')
  const done = { text: 'Compare your pay with the market', points: 10, estimatedMinutes: 30, completed: true, recurring: false, completedAt: '2026-10-14T10:00:00Z' }
  const started = { text: 'Have one coffee chat this month', actionType: 'OUTREACH_CALL', points: 10, estimatedMinutes: 30, completed: false, recurring: true, completionCount: 2 }
  const open = { text: 'Refresh your LinkedIn quietly', actionType: 'LINKEDIN_SETUP', points: 5, estimatedMinutes: 20, completed: false, recurring: false }

  it('keeps finished and started steps, replaces the open ones with the new journey', () => {
    const { actions, kept, replaced } = mergeRebuiltPlan([done, started, open], [
      { text: 'Name the gap to the next level' },
      { text: 'Compare your pay with the market' }, // already done: not offered again
      { text: 'Plan your next conversation with your manager' },
    ])
    expect(kept).toBe(2)
    expect(actions.slice(0, 2)).toEqual([done, started])
    expect(actions.map((a) => a.text)).not.toContain('Refresh your LinkedIn quietly')
    expect(actions.filter((a) => a.text === 'Compare your pay with the market')).toHaveLength(1)
    expect(replaced).toBe(2)
    expect(actions.slice(2).every((a) => a.completed === false)).toBe(true)
  })
  it('never hands back fewer than four open steps when there are suggestions', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ text: `Step ${i}` }))
    expect(mergeRebuiltPlan([done], many).replaced).toBe(4)
  })
  it('does not offer a finished one-time step of the same kind again', () => {
    const finished = { ...open, completed: true }
    const { actions } = mergeRebuiltPlan([finished], [{ text: 'Set up LinkedIn again', actionType: 'LINKEDIN_SETUP' }, { text: 'Something else' }])
    expect(actions.map((a) => a.text)).toEqual(['Refresh your LinkedIn quietly', 'Something else'])
  })
})
