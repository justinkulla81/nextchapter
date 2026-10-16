import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { parseBoardSearchParams } from '@/lib/jobs/board-search'
import {
  buildBoardSearch,
  buildSearchIndex,
  peekSearchIndex,
  resetSearchIndexForTests,
  searchIndexWithin,
  warmSearchIndex,
  type SearchIndex,
} from '@/lib/jobs/board-search-index'

// One job whose title says nothing about FP&A; only its skills do.
const facts = [
  {
    id: 'j1', title: 'Finance Manager', companyName: 'Acme', industry: 'Manufacturing', socTitle: null, workArrangement: null,
    locationCity: 'Austin', locationState: 'TX', states: null, skills: 'fpa forecasting',
  },
]
const row = { id: 'j1', title: 'Finance Manager', companyName: 'Acme', location: 'Austin, TX', targetFunction: null, targetRemotePolicy: null }

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}

describe('search index readiness: a search never waits on a cold index', () => {
  afterEach(() => {
    vi.useRealTimers()
    resetSearchIndexForTests()
  })

  let load: ReturnType<typeof deferred<SearchIndex>>
  let reads: number
  beforeEach(() => {
    reads = 0
    load = deferred<SearchIndex>()
    resetSearchIndexForTests(() => {
      reads++
      return load.promise
    })
  })

  it('takes the light-fields fast path on a cold instance, leaving the first load to the board warm-up', async () => {
    const started = Date.now()
    const s = await buildBoardSearch(parseBoardSearchParams({ q: 'finance manager' }), 20)
    expect(Date.now() - started).toBeLessThan(1000)
    expect(s?.indexReady).toBe(false)
    // The search itself doesn't start the big read (it would compete with the board's own).
    expect(reads).toBe(0)
    void warmSearchIndex() // what the board page does once its shortlist is in
    expect(reads).toBe(1)
    // Title / company / location still match on the fast path…
    expect(s?.relevance(row)).toBe(0)
    expect((await buildBoardSearch(parseBoardSearchParams({ q: 'acme', loc: 'Austin, TX' }), 0))?.relevance(row)).toBe(3)
    // …skills only match once the index is in.
    expect((await buildBoardSearch(parseBoardSearchParams({ q: 'fpa' }), 0))?.relevance(row)).toBeNull()
    expect(reads).toBe(1) // one load in flight, not one per search
    load.resolve(buildSearchIndex(facts))
    await warmSearchIndex()
    const full = await buildBoardSearch(parseBoardSearchParams({ q: 'fpa' }), 0)
    expect(full?.indexReady).toBe(true)
    expect(full?.relevance(row)).toBe(2)
  })

  it('uses an index that arrives within the wait budget', async () => {
    void warmSearchIndex()
    const pending = buildBoardSearch(parseBoardSearchParams({ q: 'fpa' }), 5_000)
    load.resolve(buildSearchIndex(facts))
    const s = await pending
    expect(s?.indexReady).toBe(true)
    expect(s?.relevance(row)).toBe(2)
  })

  it('a failed load falls back to the fast path and is retried by the next warm-up', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    void warmSearchIndex()
    const s1 = buildBoardSearch(parseBoardSearchParams({ q: 'finance' }), 5_000)
    load.reject(new Error('db down'))
    expect((await s1)?.indexReady).toBe(false)
    expect((await s1)?.relevance(row)).toBe(0)
    load = deferred<SearchIndex>()
    void warmSearchIndex()
    expect(reads).toBe(2)
    errors.mockRestore()
  })

  it('warmSearchIndex never rejects, and peek holds the index once in', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(peekSearchIndex({ startCold: false })).toBeNull()
    expect(reads).toBe(0)
    expect(peekSearchIndex()).toBeNull() // the typeahead: starts the load
    expect(reads).toBe(1)
    load.reject(new Error('db down'))
    await expect(warmSearchIndex()).resolves.toBeUndefined()
    load = deferred<SearchIndex>()
    const warming = warmSearchIndex()
    load.resolve(buildSearchIndex(facts))
    await warming
    expect(peekSearchIndex()?.pos.get('j1')).toBe(0)
    errors.mockRestore()
  })

  it('stale-while-revalidate: an old index is used at once while a fresh one loads', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const first = buildSearchIndex(facts)
    const warming = warmSearchIndex()
    load.resolve(first)
    await warming
    expect(reads).toBe(1)
    vi.setSystemTime(Date.now() + 2 * 60 * 60_000) // past both the fresh and stale windows
    load = deferred<SearchIndex>()
    expect(await searchIndexWithin(0)).toBe(first)
    expect(reads).toBe(2)
    const second = buildSearchIndex(facts)
    load.resolve(second)
    await warmSearchIndex()
    expect(peekSearchIndex()).toBe(second)
  })

  it('no search entered: no index needed, nothing loaded', async () => {
    expect(await buildBoardSearch(parseBoardSearchParams({ sort: 'newest' }))).toBeNull()
    expect(reads).toBe(0)
  })
})
