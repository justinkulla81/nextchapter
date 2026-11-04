import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/crm/sync', () => ({ refreshTouchFields: vi.fn() }))

import { emptyDuplicateOpportunityIds } from '@/lib/crm/merge-person'

describe('emptyDuplicateOpportunityIds', () => {
  it('drops an empty opportunity in a pipeline the survivor already has', () => {
    expect(emptyDuplicateOpportunityIds([{ id: 'o1', pipelineId: 'membership', history: 0 }], ['membership'])).toEqual(['o1'])
  })
  it('keeps one with history, so it moves to the survivor', () => {
    expect(emptyDuplicateOpportunityIds([{ id: 'o1', pipelineId: 'membership', history: 2 }], ['membership'])).toEqual([])
  })
  it('keeps an empty one in a pipeline the survivor is not in', () => {
    expect(emptyDuplicateOpportunityIds([{ id: 'o1', pipelineId: 'sales', history: 0 }], ['membership'])).toEqual([])
  })
})
