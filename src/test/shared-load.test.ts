import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
// Stands in for Next's data cache: runs the function once per key and hands back what it stored.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}))

import { sharedLoad } from '@/lib/db/heavy'

describe('sharedLoad', () => {
  it('hands back dates as dates and keeps other values', async () => {
    const at = new Date('2026-10-30T12:00:00.000Z')
    const out = await sharedLoad('t1', 60, async () => [{ at, n: 3, s: 'https://x.test/a', none: null }])
    expect(out[0].at).toBeInstanceOf(Date)
    expect(out[0].at.getTime()).toBe(at.getTime())
    expect(out[0]).toMatchObject({ n: 3, s: 'https://x.test/a', none: null })
  })

  it('rethrows a loader failure without running it twice', async () => {
    const load = vi.fn().mockRejectedValue(new Error('db down'))
    await expect(sharedLoad('t2', 60, load)).rejects.toThrow('db down')
    expect(load).toHaveBeenCalledTimes(1)
  })
})
