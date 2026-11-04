import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const capture = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: (...a: unknown[]) => capture(...a) }))

import { DataTimeoutError, mustArriveWithin, timed, timedWithin } from '@/lib/perf/timed'
import { judgeSlowRows, topOffenders, type SlowRow } from '@/lib/perf/slow-alert'
import { weeklyDelta, type StatementRow } from '@/lib/perf/db-report'

const never = <T>() => new Promise<T>(() => {})

describe('timedWithin', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    capture.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('gives the fallback at the deadline and records a miss, never a quiet success', async () => {
    const result = timedWithin('layout', 'freshJobs', 'c1', never<number>(), 0, 1_500)
    await vi.advanceTimersByTimeAsync(1_500)
    expect(await result).toBe(0)
    const events = capture.mock.calls.map((c) => c[1])
    expect(events).toContain('page_query_slow')
    expect(events).toContain('page_query_stalled')
    expect(capture.mock.calls.find((c) => c[1] === 'page_query_slow')![2]).toMatchObject({ route: 'layout', label: 'freshJobs', ok: false, timedOut: true })
  })

  it('passes a fast answer through and records nothing', async () => {
    expect(await timedWithin('layout', 'peerUnread', 'c1', Promise.resolve(7), 0)).toBe(7)
    expect(capture).not.toHaveBeenCalled()
  })

  it('turns a failed read into the fallback and records it as failed', async () => {
    expect(await timedWithin('layout', 'helpReplies', 'c1', Promise.reject(new Error('db down')), 0)).toBe(0)
    expect(capture.mock.calls[0][2]).toMatchObject({ ok: false, timedOut: false })
  })

  it('ignores an answer that arrives after the deadline', async () => {
    let resolve!: (n: number) => void
    const late = new Promise<number>((r) => (resolve = r))
    const result = timedWithin('layout', 'needsFollowUp', 'c1', late, 0, 1_000)
    await vi.advanceTimersByTimeAsync(1_000)
    resolve(9)
    expect(await result).toBe(0)
    expect(capture.mock.calls.filter((c) => c[1] === 'page_query_slow')).toHaveLength(1)
  })
})

describe('mustArriveWithin', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    capture.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('fails with a DataTimeoutError when the data does not arrive', async () => {
    const result = mustArriveWithin('dashboard', 'profile', 'u1', never<string>(), 12_000)
    const caught = result.catch((e) => e)
    await vi.advanceTimersByTimeAsync(12_000)
    expect(await caught).toBeInstanceOf(DataTimeoutError)
    expect(capture.mock.calls.map((c) => c[1])).toContain('page_query_stalled')
  })

  it('returns the data when it arrives in time', async () => {
    expect(await mustArriveWithin('dashboard', 'profile', 'u1', Promise.resolve('ok'))).toBe('ok')
  })
})

describe('timed', () => {
  it('still passes errors through', async () => {
    capture.mockReset()
    await expect(timed('home', 'x', 'c1', Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(capture.mock.calls[0][2]).toMatchObject({ ok: false, timedOut: false })
  })
})

const row = (o: Partial<SlowRow>): SlowRow => ({ event: 'page_load_slow', who: 'a', route: null, label: null, path: '/dashboard', timedOut: false, ms: 4_000, ...o })

describe('judgeSlowRows', () => {
  it('stays quiet for one person having one slow page', () => {
    expect(judgeSlowRows([row({})]).alert).toBe(false)
  })

  it('stays quiet for many reports from one person', () => {
    expect(judgeSlowRows(Array.from({ length: 8 }, () => row({}))).alert).toBe(false)
  })

  it('alerts when several people are waiting', () => {
    const rows = ['a', 'b', 'a', 'b', 'c'].map((who) => row({ who }))
    const v = judgeSlowRows(rows)
    expect(v.alert).toBe(true)
    expect(v.people).toBe(3)
  })

  it('alerts when reads keep giving up at their deadline', () => {
    const rows = Array.from({ length: 3 }, () => row({ event: 'page_query_stalled', route: 'layout', label: 'freshJobs', timedOut: true, ms: 1_500 }))
    const v = judgeSlowRows(rows)
    expect(v.alert).toBe(true)
    expect(v.timeouts).toBe(3)
  })

  it('names the biggest offenders first', () => {
    const rows = [
      row({ event: 'page_query_stalled', route: 'layout', label: 'freshJobs', ms: 120_000 }),
      row({ event: 'page_query_stalled', route: 'layout', label: 'freshJobs', ms: 90_000 }),
      row({ path: '/dashboard/find-my-job', ms: 5_000 }),
    ]
    expect(topOffenders(rows)[0]).toEqual({ what: 'layout · freshJobs', count: 2, worstMs: 120_000 })
  })
})

const st = (queryid: string, calls: number, totalMs: number, maxMs = 1_000): StatementRow => ({ queryid, calls, totalMs, maxMs, query: `q${queryid}` })

describe('weeklyDelta', () => {
  it('reports this week, not all time', () => {
    const now = [st('a', 1_000, 900_000), st('b', 50, 200_000)]
    const before = { a: { calls: 990, totalMs: 890_000 }, b: { calls: 0, totalMs: 0 } }
    const out = weeklyDelta(now, before)
    expect(out.map((r) => r.queryid)).toEqual(['b', 'a'])
    expect(out[0]).toMatchObject({ deltaCalls: 50, deltaMs: 200_000 })
    expect(out[1]).toMatchObject({ deltaCalls: 10, deltaMs: 10_000 })
  })

  it('uses the full count on the first run and after a counter reset', () => {
    expect(weeklyDelta([st('a', 10, 5_000)], null)[0]).toMatchObject({ deltaCalls: 10, deltaMs: 5_000 })
    expect(weeklyDelta([st('a', 10, 5_000)], { a: { calls: 500, totalMs: 900_000 } })[0]).toMatchObject({ deltaCalls: 10 })
  })

  it('drops statements that did not run this week', () => {
    expect(weeklyDelta([st('a', 10, 5_000)], { a: { calls: 10, totalMs: 5_000 } })).toEqual([])
  })
})
