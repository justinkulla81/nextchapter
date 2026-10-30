import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('db heavy helpers', async () => {
  const { heavy, memoTtl, retryOnPoolTimeout } = await import('@/lib/db/heavy')

  it('runs at most three heavy scans at once', async () => {
    let live = 0
    let peak = 0
    const task = () => heavy(async () => {
      live++
      peak = Math.max(peak, live)
      await new Promise((r) => setTimeout(r, 10))
      live--
    })
    await Promise.all(Array.from({ length: 9 }, task))
    expect(peak).toBe(3)
  })

  it('shares one in-flight load and forgets failures', async () => {
    const load = vi.fn(async (k: string) => `v-${k}`)
    const get = memoTtl(1000, (k: string) => k, load)
    expect(await Promise.all([get('a'), get('a')])).toEqual(['v-a', 'v-a'])
    expect(load).toHaveBeenCalledTimes(1)
    let n = 0
    const flaky = memoTtl(1000, () => 'k', async () => { if (n++ === 0) throw new Error('x'); return 'ok' })
    await expect(flaky()).rejects.toThrow('x')
    await expect(flaky()).resolves.toBe('ok')
  })

  it('retries a busy pool but not other errors', async () => {
    let calls = 0
    await expect(retryOnPoolTimeout(async () => { if (calls++ < 2) throw Object.assign(new Error('pool'), { code: 'P2024' }); return 'done' })).resolves.toBe('done')
    await expect(retryOnPoolTimeout(async () => { throw new Error('other') })).rejects.toThrow('other')
    calls = 0
    await expect(retryOnPoolTimeout(async () => { if (calls++ < 1) throw new Error('Error in connector: FATAL: (EMAXCONN) max client connections reached, limit: 600'); return 'done' })).resolves.toBe('done')
  })
})
