import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))
vi.mock('next/server', () => ({ after: (fn: () => void) => fn() }))
vi.mock('@/lib/db/heavy', () => ({ heavy: (f: () => unknown) => f(), sharedLoad: (_k: string, _t: number, f: () => unknown) => f() }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { dueTopics, firmRefreshAllowed, SNAPSHOT_MAX_AGE_MS, SNAPSHOT_PEAK_MAX_AGE_MS } from '@/lib/seo/topic-snapshot'

const H = 3600_000
const now = Date.UTC(2026, 10, 9, 12)
const t = (key: string, ageH: number) => ({ f: key, key, at: now - ageH * H })

describe('dueTopics', () => {
  const all = [t('fresh', 10), t('two-days', 50), t('four-days', 100), t('missing', 1e6)].map((x) => (x.key === 'missing' ? { ...x, at: 0 } : x))
  it('off-peak refreshes everything over 48 h, stalest first', () => {
    expect(dueTopics(all, now, { offPeak: true }).map((x) => x.key)).toEqual(['missing', 'four-days', 'two-days'])
  })
  it('at peak only refreshes snapshots over 96 h or missing', () => {
    expect(dueTopics(all, now, { offPeak: false }).map((x) => x.key)).toEqual(['missing', 'four-days'])
  })
  it('keeps the ages as documented', () => {
    expect(SNAPSHOT_MAX_AGE_MS).toBe(48 * H)
    expect(SNAPSHOT_PEAK_MAX_AGE_MS).toBe(96 * H)
  })
})

describe('firmRefreshAllowed', () => {
  const at = (h: number) => Date.UTC(2026, 10, 11, h, 40)
  it('only at 02 and 05 UTC', () => {
    expect([...Array(24).keys()].filter((h) => firmRefreshAllowed(at(h)))).toEqual([2, 5])
  })
  it('a manual run always tries', () => {
    expect(firmRefreshAllowed(at(14), true)).toBe(true)
  })
})
