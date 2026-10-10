import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  parseHistogram,
  parseHistory,
  parseTopCompanies,
  parseGeodata,
  parseDemandCount,
  histogramPercentile,
  histogramShareBelow,
  historyChangePct,
  normalizeRoleQuery,
  resolveState,
  locationKey,
  periodKey,
  budgetBucketsFor,
  getInsight,
  REFRESH_INTERVAL_MS,
  ERROR_RETRY_MS,
  BUDGET_LIMITS,
  type BudgetStore,
  type CacheRow,
  type InsightDeps,
  type InsightKey,
  type InsightStore,
  type LiveResult,
} from '@/lib/market/adzuna-insights-core'

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(__dirname, 'fixtures/adzuna', name), 'utf8')) as unknown

// ── Parsing (real responses recorded from the live API) ─────────────────────

describe('parseHistogram', () => {
  const h = parseHistogram(fixture('hist.json'))!
  it('sorts buckets numerically, not lexically', () => {
    expect(h.buckets.map((b) => b.min)).toEqual([20000, 40000, 60000, 80000, 100000, 120000, 140000])
  })
  it('totals the counts', () => {
    expect(h.total).toBe(52 + 172 + 125 + 196 + 203 + 268 + 963)
  })
  it('returns null for an empty or malformed response', () => {
    expect(parseHistogram({ histogram: {} })).toBeNull()
    expect(parseHistogram({ error: 'x' })).toBeNull()
    expect(parseHistogram(null)).toBeNull()
  })
})

describe('parseHistory', () => {
  const h = parseHistory(fixture('history.json'))!
  it('orders months ascending and rounds salaries', () => {
    expect(h.points.map((p) => p.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    expect(h.points[0].averageSalary).toBe(140327)
  })
  it('computes the change from first to last month', () => {
    expect(historyChangePct(h)).toBeCloseTo(-7.8, 1)
  })
  it('ignores junk keys', () => {
    expect(parseHistory({ month: { nope: 5, '2026-01': 0 } })).toBeNull()
  })
})

describe('parseTopCompanies', () => {
  it('reads the leaderboard busiest first', () => {
    const t = parseTopCompanies(fixture('top.json'))!
    expect(t.companies[0]).toEqual({ name: 'Amazon', count: 245 })
    expect(t.companies.map((c) => c.name)).toContain('State Street')
    expect(t.companies).toHaveLength(5)
  })
  it('returns null for an empty leaderboard', () => {
    expect(parseTopCompanies({ leaderboard: [] })).toBeNull()
  })
})

describe('parseGeodata', () => {
  it('reads state names from area[1]', () => {
    const g = parseGeodata(fixture('geo.json'))!
    expect(g.states[0]).toEqual({ state: 'California', count: 18423 })
    expect(g.states.find((s) => s.state === 'Massachusetts')?.count).toBe(5513)
  })
})

describe('parseDemandCount', () => {
  it('reads count and mean salary', () => {
    expect(parseDemandCount(fixture('search-count.json'))).toEqual({ count: 7484, meanSalary: 129491 })
  })
  it('keeps a zero count but drops a missing mean', () => {
    expect(parseDemandCount({ count: 0 })).toEqual({ count: 0, meanSalary: null })
    expect(parseDemandCount({})).toBeNull()
  })
})

// ── Derived numbers ─────────────────────────────────────────────────────────

describe('histogram percentiles', () => {
  const h = { buckets: [{ min: 100000, count: 50 }, { min: 120000, count: 50 }], total: 100 }
  it('interpolates within a bucket', () => {
    expect(histogramPercentile(h, 0.25)).toBe(110000)
  })
  it('reports the open-ended top bucket as its floor', () => {
    expect(histogramPercentile(h, 0.9)).toBe(120000)
  })
  it('share below a salary', () => {
    expect(histogramShareBelow(h, 110000)).toBeCloseTo(0.25)
    expect(histogramShareBelow(h, 90000)).toBe(0)
  })
})

// ── Normalization ───────────────────────────────────────────────────────────

describe('normalizeRoleQuery', () => {
  it('lowercases, strips punctuation and filler words', () => {
    expect(normalizeRoleQuery('VP of Marketing & Growth')).toBe('vp marketing growth')
    expect(normalizeRoleQuery('  Head of the Data Team ')).toBe('head data team')
  })
  it('returns null for empty input', () => {
    expect(normalizeRoleQuery('')).toBeNull()
    expect(normalizeRoleQuery(' of the ')).toBeNull()
    expect(normalizeRoleQuery(null)).toBeNull()
  })
})

describe('resolveState', () => {
  it.each([
    ['MA', 'Massachusetts'],
    ['ma', 'Massachusetts'],
    ['new york', 'New York'],
    ['Remote', null],
    [null, null],
  ])('%s -> %s', (input, expected) => {
    expect(resolveState(input)).toBe(expected)
  })
  it('location keys', () => {
    expect(locationKey('New York')).toBe('new york')
    expect(locationKey(null)).toBe('us')
  })
})

// ── Budget buckets ──────────────────────────────────────────────────────────

describe('budget buckets', () => {
  const now = new Date('2026-10-10T14:03:27Z') // a Saturday
  it('labels periods in UTC with Monday-keyed weeks', () => {
    expect(periodKey('minute', now)).toBe('2026-10-10T14:03')
    expect(periodKey('day', now)).toBe('2026-10-10')
    expect(periodKey('week', now)).toBe('2026-10-05')
    expect(periodKey('week', new Date('2026-10-05T00:00:00Z'))).toBe('2026-10-05')
    expect(periodKey('month', now)).toBe('2026-10')
  })
  it('checks longest period first, for both scopes', () => {
    const b = budgetBucketsFor(['all', 'insights'], now)
    expect(b[0]).toEqual({ bucket: 'all:month:2026-10', limit: BUDGET_LIMITS.all.month })
    expect(b[3].bucket).toBe('all:minute:2026-10-10T14:03')
    expect(b[7]).toEqual({ bucket: 'insights:minute:2026-10-10T14:03', limit: BUDGET_LIMITS.insights.minute })
  })
  it('stays under Adzuna published limits', () => {
    expect(BUDGET_LIMITS.all.minute).toBeLessThan(25)
    expect(BUDGET_LIMITS.all.day).toBeLessThan(250)
    expect(BUDGET_LIMITS.all.week).toBeLessThan(1000)
    expect(BUDGET_LIMITS.all.month).toBeLessThan(2500)
  })
})

// ── Cache + budget behavior ─────────────────────────────────────────────────

function memoryStore(initial?: [InsightKey, CacheRow][]) {
  const rows = new Map<string, CacheRow & { hits: number }>()
  const id = (k: InsightKey) => `${k.endpoint}|${k.queryKey}|${k.location}`
  for (const [k, r] of initial ?? []) rows.set(id(k), { ...r, hits: 0 })
  const store: InsightStore = {
    get: async (k) => rows.get(id(k)) ?? null,
    put: async (k, r) => void rows.set(id(k), { ...r, hits: rows.get(id(k))?.hits ?? 0 }),
    markHit: async (k) => {
      const r = rows.get(id(k))
      if (r) r.hits++
    },
  }
  return { store, rows, id }
}

function memoryBudget() {
  const counts = new Map<string, number>()
  const budget: BudgetStore = {
    async tryConsume(buckets) {
      for (const { bucket, limit } of buckets) {
        const c = counts.get(bucket) ?? 0
        if (c >= limit) return false
        counts.set(bucket, c + 1)
      }
      return true
    },
    async record(buckets) {
      for (const b of buckets) counts.set(b, (counts.get(b) ?? 0) + 1)
    },
  }
  return { budget, counts }
}

const NOW = new Date('2026-10-10T14:03:00Z')
const KEY = { endpoint: 'histogram' as const, queryKey: 'product manager', location: 'massachusetts' }

function setup(opts: { initial?: [InsightKey, CacheRow][]; live?: LiveResult; schedule?: boolean } = {}) {
  const mem = memoryStore(opts.initial)
  const b = memoryBudget()
  const fetchLive = vi.fn(async () => opts.live ?? ({ ok: true, json: fixture('hist.json') } as LiveResult))
  const scheduled: (() => Promise<void>)[] = []
  const deps: InsightDeps = {
    store: mem.store,
    budget: b.budget,
    fetchLive,
    now: () => NOW,
    ...(opts.schedule ? { schedule: (t) => void scheduled.push(t) } : {}),
  }
  return { ...mem, ...b, fetchLive, scheduled, deps }
}

describe('getInsight', () => {
  it('cold miss fetches live, stores a week-long row and counts the call', async () => {
    const s = setup()
    const r = await getInsight({ ...KEY }, s.deps, { onMiss: 'fetch' })
    expect(r.source).toBe('live')
    expect(r.data?.total).toBe(1979)
    expect(s.fetchLive).toHaveBeenCalledTimes(1)
    const row = s.rows.get(s.id(KEY))!
    expect(row.refreshAfter.getTime() - NOW.getTime()).toBe(REFRESH_INTERVAL_MS)
    expect(s.counts.get('all:day:2026-10-10')).toBe(1)
    expect(s.counts.get('insights:minute:2026-10-10T14:03')).toBe(1)
  })

  it('fresh row is served from cache with no live call', async () => {
    const payload = parseHistogram(fixture('hist.json'))
    const s = setup({ initial: [[KEY, { payload, error: null, fetchedAt: NOW, refreshAfter: new Date(NOW.getTime() + 1000) }]] })
    const r = await getInsight({ ...KEY }, s.deps)
    expect(r.source).toBe('cache')
    expect(s.fetchLive).not.toHaveBeenCalled()
    expect(s.rows.get(s.id(KEY))!.hits).toBe(1)
  })

  it('stale row is served immediately and refreshed in the background', async () => {
    const payload = parseHistogram(fixture('hist.json'))
    const old = new Date(NOW.getTime() - REFRESH_INTERVAL_MS - 1)
    const s = setup({ schedule: true, initial: [[KEY, { payload, error: null, fetchedAt: old, refreshAfter: old }]] })
    const r = await getInsight({ ...KEY }, s.deps, { onMiss: 'fetch' })
    expect(r.source).toBe('stale_cache')
    expect(r.fetchedAt).toEqual(old)
    expect(s.fetchLive).not.toHaveBeenCalled()
    expect(s.scheduled).toHaveLength(1)
    await s.scheduled[0]()
    expect(s.fetchLive).toHaveBeenCalledTimes(1)
    expect(s.rows.get(s.id(KEY))!.fetchedAt).toEqual(NOW)
  })

  it('background miss returns nothing now and fills the cache later', async () => {
    const s = setup({ schedule: true })
    const r = await getInsight({ ...KEY }, s.deps, { onMiss: 'background' })
    expect(r).toMatchObject({ data: null, source: 'none', skipped: 'deferred' })
    await s.scheduled[0]()
    expect(s.rows.get(s.id(KEY))?.payload).not.toBeNull()
  })

  it('over budget: never calls live, serves stale cache', async () => {
    const payload = parseHistogram(fixture('hist.json'))
    const old = new Date(NOW.getTime() - REFRESH_INTERVAL_MS - 1)
    const s = setup({ initial: [[KEY, { payload, error: null, fetchedAt: old, refreshAfter: old }]] })
    s.counts.set('insights:day:2026-10-10', BUDGET_LIMITS.insights.day)
    const r = await getInsight({ ...KEY }, s.deps)
    expect(r).toMatchObject({ source: 'stale_cache', skipped: 'over_budget' })
    expect(r.data?.total).toBe(1979)
    expect(s.fetchLive).not.toHaveBeenCalled()
  })

  it('over budget with nothing cached returns nothing', async () => {
    const s = setup()
    s.counts.set('all:month:2026-10', BUDGET_LIMITS.all.month)
    const r = await getInsight({ ...KEY }, s.deps, { onMiss: 'fetch' })
    expect(r).toMatchObject({ data: null, source: 'none', skipped: 'over_budget' })
    expect(s.fetchLive).not.toHaveBeenCalled()
  })

  it('the per-minute guard caps a burst of cold misses', async () => {
    const s = setup()
    const keys = Array.from({ length: BUDGET_LIMITS.insights.minute + 5 }, (_, i) => ({ ...KEY, queryKey: `role ${i}` }))
    const results = await Promise.all(keys.map((k) => getInsight(k, s.deps, { onMiss: 'fetch' })))
    expect(s.fetchLive).toHaveBeenCalledTimes(BUDGET_LIMITS.insights.minute)
    expect(results.filter((r) => r.skipped === 'over_budget')).toHaveLength(5)
  })

  it('a failed refresh keeps the old payload and retries after a day', async () => {
    const payload = parseHistogram(fixture('hist.json'))
    const old = new Date(NOW.getTime() - REFRESH_INTERVAL_MS - 1)
    const s = setup({ live: { ok: false, error: 'Adzuna histogram returned 503' }, initial: [[KEY, { payload, error: null, fetchedAt: old, refreshAfter: old }]] })
    const r = await getInsight({ ...KEY }, s.deps)
    expect(r.source).toBe('stale_cache')
    const row = s.rows.get(s.id(KEY))!
    expect(row.payload).toEqual(payload)
    expect(row.error).toContain('503')
    expect(row.refreshAfter.getTime() - NOW.getTime()).toBe(ERROR_RETRY_MS)
  })

  it('an empty answer is cached as "no data" so it is not re-asked every view', async () => {
    const s = setup({ live: { ok: true, json: { histogram: {} } } })
    const first = await getInsight({ ...KEY }, s.deps)
    expect(first.source).toBe('none')
    const second = await getInsight({ ...KEY }, s.deps)
    expect(second.source).toBe('none')
    expect(s.fetchLive).toHaveBeenCalledTimes(1)
  })

  it('concurrent misses for the same key share one live call', async () => {
    const s = setup()
    await Promise.all([getInsight({ ...KEY }, s.deps), getInsight({ ...KEY }, s.deps)])
    expect(s.fetchLive).toHaveBeenCalledTimes(1)
  })

  it('not configured: no budget spent, no call', async () => {
    const s = setup()
    const r = await getInsight({ ...KEY }, { ...s.deps, configured: false })
    expect(r.skipped).toBe('not_configured')
    expect(s.counts.size).toBe(0)
  })
})

describe('parseHistogram leading zeros', () => {
  it('drops leading empty buckets but keeps the rest', () => {
    const h = parseHistogram({ histogram: { '20000': 0, '40000': 0, '60000': 3, '80000': 0, '100000': 4 } })!
    expect(h.buckets.map((b) => b.min)).toEqual([60000, 80000, 100000])
  })
})
