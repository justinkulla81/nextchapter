import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { sumEffortMinutes } from './effort-minutes'

describe('sumEffortMinutes', () => {
  it('adds earned points across sprints', () => {
    expect(
      sumEffortMinutes([
        { committedActions: [{ points: 30, completed: true }, { points: 20, completed: false }] },
        { committedActions: [{ points: 10, completed: true, completionCount: 3 }] },
      ])
    ).toBe(60)
  })
  it('ignores malformed rows', () => {
    expect(sumEffortMinutes([{ committedActions: null }, { committedActions: [{}] }])).toBe(0)
  })
})
