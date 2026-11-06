import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const queryRaw = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) } }))

import { formatClock, isWaitOp, p95, thinkingText, thinkingView, THINKING_AFTER_MS } from '@/lib/perf/thinking-timer'
import { waitEstimate } from '@/lib/perf/wait-estimate'
import { estimateCallCostUsd } from '@/lib/ai-spend/price'

describe('thinking clock', () => {
  it('shows nothing for a wait under 10 s', () => {
    expect(thinkingView(THINKING_AFTER_MS - 1, 30_000)).toEqual({ show: false })
  })

  it('counts down to the 95th percentile once past 10 s', () => {
    const view = thinkingView(12_000, 40_000)
    expect(view).toMatchObject({ show: true, state: 'counting', remainingSeconds: 28 })
    expect(thinkingText(view as Extract<typeof view, { show: true }>)).toBe('about 0:28 left')
  })

  it('stops promising when the wait outlasts the estimate', () => {
    const view = thinkingView(47_000, 40_000)
    expect(view).toMatchObject({ show: true, state: 'over' })
    expect(thinkingText(view as Extract<typeof view, { show: true }>)).toBe('taking longer than usual · 0:47')
  })

  it('counts up while there is no estimate', () => {
    const view = thinkingView(14_000, null)
    expect(view).toMatchObject({ show: true, state: 'untimed' })
    expect(thinkingText(view as Extract<typeof view, { show: true }>)).toBe('0:14')
  })

  it('formats clocks as m:ss', () => {
    expect(formatClock(7)).toBe('0:07')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(-3)).toBe('0:00')
  })

  it('takes the 95th percentile by nearest rank', () => {
    expect(p95([])).toBeNull()
    expect(p95([5])).toBe(5)
    expect(p95(Array.from({ length: 20 }, (_, i) => (i + 1) * 1000))).toBe(19_000)
  })

  it('only accepts the listed waits', () => {
    expect(isWaitOp('resume_parse')).toBe(true)
    expect(isWaitOp('drop table')).toBe(false)
  })
})

describe('waitEstimate', () => {
  it('gives no figure below the minimum number of recent waits, and caches an answer', async () => {
    queryRaw.mockReset()
    queryRaw.mockResolvedValueOnce([{ n: 3, p95: 20_000 }])
    expect(await waitEstimate('retune', 1_000_000)).toEqual({ p95Ms: null, samples: 3 })
    expect(await waitEstimate('retune', 1_000_500)).toEqual({ p95Ms: null, samples: 3 })
    expect(queryRaw).toHaveBeenCalledTimes(1)
  })

  it('rounds the 95th percentile of enough recent waits', async () => {
    queryRaw.mockReset()
    queryRaw.mockResolvedValueOnce([{ n: 14, p95: 16_012.6 }])
    expect(await waitEstimate('resume_parse', 5_000_000)).toEqual({ p95Ms: 16_013, samples: 14 })
  })

  it('never counts down from longer than the wait can last (retune is cut off at 20 s)', async () => {
    queryRaw.mockReset()
    queryRaw.mockResolvedValueOnce([{ n: 9, p95: 229_525 }])
    expect(await waitEstimate('retune', 20_000_000)).toEqual({ p95Ms: 20_000, samples: 9 })
  })

  it('falls back to no estimate when the database does not answer', async () => {
    queryRaw.mockReset()
    queryRaw.mockRejectedValueOnce(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await waitEstimate('page', 9_000_000)).toEqual({ p95Ms: null, samples: 0 })
  })
})

describe('estimateCallCostUsd', () => {
  it('prices a call from its token usage', () => {
    // 10,000 in + 3,000 out on Opus 5: $0.05 + $0.075
    expect(estimateCallCostUsd('claude-opus-5', { input_tokens: 10_000, output_tokens: 3_000 })).toBeCloseTo(0.125, 6)
    expect(estimateCallCostUsd('claude-haiku-4-5-20251001', { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(1, 6)
  })

  it('prices cache reads at a tenth and returns null for an unlisted model', () => {
    expect(estimateCallCostUsd('claude-sonnet-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.2, 6)
    expect(estimateCallCostUsd('some-new-model', { input_tokens: 1, output_tokens: 1 })).toBeNull()
  })
})
