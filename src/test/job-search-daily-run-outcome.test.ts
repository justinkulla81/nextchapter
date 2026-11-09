import { describe, expect, it } from 'vitest'
import { finishesWithin, runStatus } from '@/lib/job-search-daily/run-outcome'

describe('runStatus', () => {
  it('is OK only when every member was handled', () => {
    expect(runStatus({ failed: 0, skippedForTime: 0 })).toBe(200)
  })
  it('fails the run when members failed, as on 2026-11-09 when all of them hit the cap', () => {
    expect(runStatus({ failed: 15, skippedForTime: 0 })).toBe(500)
    expect(runStatus({ failed: 1, skippedForTime: 0 })).toBe(500)
  })
  it('fails the run when members were skipped for time', () => {
    expect(runStatus({ failed: 0, skippedForTime: 3 })).toBe(500)
  })
})

describe('finishesWithin', () => {
  it('reports success and how long the work took', async () => {
    const r = await finishesWithin(new Promise((resolve) => setTimeout(resolve, 10)), 1000)
    expect(r.ok).toBe(true)
  })
  it('reports a slow load as not finished, without throwing', async () => {
    const r = await finishesWithin(new Promise(() => {}), 20)
    expect(r).toMatchObject({ ok: false })
    expect((r as { reason: string }).reason).toContain('not finished after 20ms')
  })
  it('reports a load that throws, with its message', async () => {
    const r = await finishesWithin(Promise.reject(new Error('db down')), 1000)
    expect(r).toMatchObject({ ok: false, reason: 'db down' })
  })
})
