import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { placeForSearch } from '@/lib/leads/lifecycle/similar-jobs'

describe('placeForSearch', () => {
  it('shows the place that matches the alert, not just the first one listed', () => {
    expect(placeForSearch('Sterling, VA, US; Denver, CO, US', 'Denver')).toBe('Denver, CO, US')
    expect(placeForSearch('Sterling, VA, US; Denver, CO, US', '')).toBe('Sterling, VA, US')
    expect(placeForSearch('Boston, MA', 'Denver')).toBe('Boston, MA')
    expect(placeForSearch(null, 'Denver')).toBeNull()
  })
})
