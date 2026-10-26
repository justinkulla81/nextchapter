import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backoff } from '@/lib/email-tracking/gmail-api'

describe('gmail retry backoff', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits 2s, 4s, 8s, 16s when there is no deadline', async () => {
    for (const [attempt, ms] of [[1, 4000], [2, 8000], [3, 16000], [4, 32000]] as const) {
      const p = backoff(attempt)
      await vi.advanceTimersByTimeAsync(ms)
      await expect(p).resolves.toBe(true)
    }
  })

  it('gives up instead of waiting past the deadline', async () => {
    const deadline = Date.now() + 10_000
    await expect(backoff(3, deadline)).resolves.toBe(false) // 16s > 10s left
    const p = backoff(2, deadline) // 8s fits
    await vi.advanceTimersByTimeAsync(8000)
    await expect(p).resolves.toBe(true)
  })
})
