import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { HEAP_RANGE_BLOCKS, heapRanges, heapRangeSql } from '@/lib/db/heap-ranges'

describe('heapRanges', () => {
  it('covers the table in back-to-back ranges, the last one open-ended', () => {
    expect(heapRanges(25, 10)).toEqual([
      { from: '(0,0)', to: '(10,0)' },
      { from: '(10,0)', to: '(20,0)' },
      { from: '(20,0)', to: null },
    ])
    expect(heapRanges(20, 10)).toEqual([{ from: '(0,0)', to: '(10,0)' }, { from: '(10,0)', to: null }])
  })

  it('gives one open range for an empty or tiny table', () => {
    expect(heapRanges(0)).toEqual([{ from: '(0,0)', to: null }])
    expect(heapRanges(5, 10)).toEqual([{ from: '(0,0)', to: null }])
  })

  it('keeps a full pass of today’s 2 GB heap to a few dozen reads', () => {
    expect(heapRanges(251_415).length).toBeLessThanOrEqual(40)
    expect(HEAP_RANGE_BLOCKS).toBeLessThanOrEqual(10_000) // ~50k rows at most in one range, if every row in it were live
  })

  it('puts no OR on the upper end, which would stop the planner using a TID range scan', () => {
    expect(heapRangeSql({ from: '(0,0)', to: '(10,0)' }).sql).toBe('ctid >= ?::tid AND ctid < ?::tid')
    expect(heapRangeSql({ from: '(10,0)', to: null }).sql).toBe('ctid >= ?::tid')
  })
})
