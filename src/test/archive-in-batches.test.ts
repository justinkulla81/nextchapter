import { describe, expect, it } from 'vitest'
import { archiveInBatches } from '@/lib/jobs/archive-in-batches'

/** A table of `rows` stale rows; each batch removes up to `limit` of them. */
const table = (rows: number) => {
  const calls: number[] = []
  return {
    calls,
    run: async (limit: number) => {
      calls.push(limit)
      const n = Math.min(limit, rows)
      rows -= n
      return n
    },
  }
}

describe('archiveInBatches', () => {
  it('archives everything in bounded batches and reports done', async () => {
    const t = table(12_345)
    expect(await archiveInBatches(t.run, { batchSize: 5_000 })).toEqual({ archived: 12_345, done: true })
    expect(t.calls).toEqual([5_000, 5_000, 5_000])
  })

  it('stops after the batch that comes back short, with no extra empty call when it ends on a full one', async () => {
    const t = table(10_000)
    expect(await archiveInBatches(t.run, { batchSize: 5_000 })).toEqual({ archived: 10_000, done: true })
    expect(t.calls).toHaveLength(3)
  })

  it('does nothing and is done when no row is stale', async () => {
    expect(await archiveInBatches(async () => 0)).toEqual({ archived: 0, done: true })
  })

  it('stops with done false when another batch would not fit the budget, so the caller finalizes again', async () => {
    let clock = 0
    const t = table(1_000_000)
    const run = async (limit: number) => { clock += 40_000; return t.run(limit) }
    const result = await archiveInBatches(run, { batchSize: 5_000, budgetMs: 100_000, now: () => clock })
    expect(result).toEqual({ archived: 10_000, done: false })
  })

  it('always runs at least one batch, even when the budget is tiny', async () => {
    let clock = 0
    const t = table(50_000)
    const run = async (limit: number) => { clock += 1_000; return t.run(limit) }
    const result = await archiveInBatches(run, { batchSize: 5_000, budgetMs: 0, now: () => clock })
    expect(result).toEqual({ archived: 5_000, done: false })
  })
})
