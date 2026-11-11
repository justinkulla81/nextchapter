import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// The database read: a page per call, found by the `afterId` the loader passes (the second argument of the tagged template).
let dbRows: FactsRow[] = []
const queryRaw = vi.fn(async (_strings: unknown, afterId: string, limit: number) => {
  const from = afterId === '' ? 0 : dbRows.findIndex((r) => r.id === afterId) + 1
  return dbRows.slice(from, from + limit)
})
const eventCreate = vi.fn(async (..._a: unknown[]) => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: [unknown, string, number]) => queryRaw(...a), analyticsEvent: { create: (...a: unknown[]) => eventCreate(...a) } } }))

const snapshot = {
  snapshotsDisabled: vi.fn(() => false),
  readManifest: vi.fn(),
  readParts: vi.fn(),
  boardFingerprint: vi.fn(),
  snapshotUsable: vi.fn(),
  writeSnapshot: vi.fn(async (..._a: unknown[]) => undefined),
  inBackground: vi.fn((task: () => Promise<void>) => void task()),
}
vi.mock('@/lib/jobs/board-snapshot', () => ({
  snapshotsDisabled: () => snapshot.snapshotsDisabled(),
  readManifest: (...a: unknown[]) => snapshot.readManifest(...a),
  readParts: (...a: unknown[]) => snapshot.readParts(...a),
  boardFingerprint: () => snapshot.boardFingerprint(),
  snapshotUsable: (...a: unknown[]) => snapshot.snapshotUsable(...a),
  writeSnapshot: (...a: unknown[]) => snapshot.writeSnapshot(...a),
  inBackground: (t: () => Promise<void>) => snapshot.inBackground(t),
  yieldToRequests: () => Promise.resolve(),
}))

import { buildSearchIndex, feedSearchFacts, IndexAccumulator, resetSearchIndexForTests, warmSearchIndex, type FactsRow } from '@/lib/jobs/board-search-index'
import { decodeFactsPart, encodeFactsPart, FACTS_PART_ROWS } from '@/lib/jobs/board-snapshot-codec'

const fact = (id: string, over: Partial<FactsRow> = {}): FactsRow => ({
  id, title: `Analyst ${id}`, companyName: 'Acme', industry: null, socTitle: null, workArrangement: null,
  locationCity: null, locationState: 'TX', states: null, skills: null, postingType: null, ...over,
})
const many = (n: number) => Array.from({ length: n }, (_, i) => fact(`r${String(i).padStart(7, '0')}`, { companyName: `Co ${i % 7}`, locationCity: i % 3 ? 'Austin' : 'Dallas', industry: i % 2 ? 'finance' : 'tech', skills: `s${i % 11} s${i % 5}` }))
const steps = () => eventCreate.mock.calls.map((c) => (c[0] as { data: { event: string; properties: { phase: string; error?: string } } }).data).filter((d) => d.event === 'search_facts_load').map((d) => d.properties.phase)
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  Object.values(snapshot).forEach((f) => f.mockClear())
  queryRaw.mockClear()
  eventCreate.mockClear()
  dbRows = []
  snapshot.snapshotsDisabled.mockReturnValue(false)
  snapshot.boardFingerprint.mockResolvedValue('fp1')
  snapshot.readManifest.mockResolvedValue(null)
  snapshot.snapshotUsable.mockReturnValue(false)
  snapshot.writeSnapshot.mockReset()
  snapshot.writeSnapshot.mockResolvedValue(undefined)
  snapshot.inBackground.mockImplementation((task: () => Promise<void>) => void task())
})

describe('the accumulator', () => {
  it('builds the same index fed page by page as in one go', () => {
    const rows = many(1_000)
    const whole = buildSearchIndex(rows, 5)
    const acc = new IndexAccumulator()
    for (let i = 0; i < rows.length; i += 300) acc.add(rows.slice(i, i + 300))
    const paged = acc.finish(5)
    expect(paged.pos).toEqual(whole.pos)
    for (const k of ['industry', 'soc', 'title', 'titleLength', 'company', 'skills', 'city', 'states', 'arrangement', 'postingType'] as const) {
      expect(Array.from(paged[k]), k).toEqual(Array.from(whole[k]))
    }
    expect(paged.tables).toEqual(whole.tables)
    expect(paged.companies).toEqual(whole.companies)
    expect(paged.cities).toEqual(whole.cities)
    expect(acc.size).toBe(1_000)
  })

  it('numbers a job by its place in the whole feed, not in its page', () => {
    const acc = new IndexAccumulator()
    acc.add([fact('a'), fact('b')])
    acc.add([fact('c')])
    expect(acc.finish().pos.get('c')).toBe(2)
  })
})

describe('feedSearchFacts', () => {
  it('feeds from the shared snapshot, part by part, and never reads the database when one is usable', async () => {
    snapshot.snapshotUsable.mockReturnValue(true)
    snapshot.readManifest.mockResolvedValue({ kind: 'search-facts', at: Date.now(), fingerprint: 'fp1', parts: ['p0', 'p1'], rows: 3 })
    snapshot.readParts.mockResolvedValue(JSON.parse(JSON.stringify([encodeFactsPart([fact('a'), fact('b')]), encodeFactsPart([fact('c')])])))
    const acc = new IndexAccumulator()
    await feedSearchFacts(acc)
    expect(acc.size).toBe(3)
    expect(queryRaw).not.toHaveBeenCalled()
    expect(snapshot.writeSnapshot).not.toHaveBeenCalled()
    expect(steps()).toEqual([])
  })

  it('reads the database a keyset page at a time, and writes the pages as the next snapshot', async () => {
    dbRows = many(FACTS_PART_ROWS * 2 + 5)
    const acc = new IndexAccumulator()
    await feedSearchFacts(acc)
    await wait()
    expect(acc.size).toBe(FACTS_PART_ROWS * 2 + 5)
    expect(queryRaw).toHaveBeenCalledTimes(3)
    expect(queryRaw.mock.calls.map((c) => c[1])).toEqual(['', dbRows[FACTS_PART_ROWS - 1].id, dbRows[FACTS_PART_ROWS * 2 - 1].id])
    const [kind, fingerprint, , parts, count] = snapshot.writeSnapshot.mock.calls[0] as unknown as [string, string, number, unknown[], number]
    expect([kind, fingerprint, count]).toEqual(['search-facts', 'fp1', FACTS_PART_ROWS * 2 + 5])
    expect(parts).toHaveLength(3)
    expect(decodeFactsPart(parts[2])).toHaveLength(5)
    expect(steps()).toEqual(['read_start', 'read_done', 'write_start', 'write_failed']) // no manifest to read back in this mock
  })

  it('records write_done when the manifest reads back as this write', async () => {
    dbRows = many(3)
    snapshot.readManifest.mockResolvedValueOnce(null).mockResolvedValue({ kind: 'search-facts', fingerprint: 'fp1', at: Date.now(), parts: [], rows: 3 })
    await feedSearchFacts(new IndexAccumulator())
    await wait()
    expect(steps()).toEqual(['read_start', 'read_done', 'write_start', 'write_done'])
  })

  it('stops at an empty page, and at a short one without asking again', async () => {
    dbRows = many(FACTS_PART_ROWS) // exactly one full page: a second call finds nothing
    await feedSearchFacts(new IndexAccumulator())
    expect(queryRaw).toHaveBeenCalledTimes(2)
    queryRaw.mockClear()
    dbRows = many(7) // a short page ends the read
    await feedSearchFacts(new IndexAccumulator())
    expect(queryRaw).toHaveBeenCalledTimes(1)
  })

  it('falls back to the database when the parts cannot be read or are in another format', async () => {
    snapshot.snapshotUsable.mockReturnValue(true)
    dbRows = many(2)
    snapshot.readParts.mockResolvedValue(null)
    const a = new IndexAccumulator()
    await feedSearchFacts(a)
    snapshot.readParts.mockResolvedValue([{ v: 9 }])
    const b = new IndexAccumulator()
    await feedSearchFacts(b)
    expect([a.size, b.size]).toEqual([2, 2])
    expect(queryRaw).toHaveBeenCalledTimes(2)
  })

  it('falls back to the database when the storage read throws', async () => {
    snapshot.readManifest.mockRejectedValue(new Error('storage down'))
    dbRows = many(2)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const acc = new IndexAccumulator()
    await feedSearchFacts(acc)
    expect(acc.size).toBe(2)
    errors.mockRestore()
  })

  it('does not touch storage, and writes nothing, when snapshots are off', async () => {
    snapshot.snapshotsDisabled.mockReturnValue(true)
    dbRows = many(2)
    const acc = new IndexAccumulator()
    await feedSearchFacts(acc)
    await wait()
    expect(acc.size).toBe(2)
    expect(snapshot.readManifest).not.toHaveBeenCalled()
    expect(snapshot.writeSnapshot).not.toHaveBeenCalled()
  })

  it('writes no snapshot when the board version is unreadable or nothing was read', async () => {
    snapshot.boardFingerprint.mockResolvedValue(null)
    dbRows = many(2)
    await feedSearchFacts(new IndexAccumulator())
    snapshot.boardFingerprint.mockResolvedValue('fp1')
    dbRows = []
    await feedSearchFacts(new IndexAccumulator())
    await wait()
    expect(snapshot.writeSnapshot).not.toHaveBeenCalled()
  })

  it('records read_failed and lets the error through when a page fails', async () => {
    queryRaw.mockRejectedValueOnce(new Error('pool timeout'))
    await expect(feedSearchFacts(new IndexAccumulator())).rejects.toThrow('pool timeout')
    await wait()
    expect(steps()).toEqual(['read_start', 'read_failed'])
    expect(snapshot.writeSnapshot).not.toHaveBeenCalled()
  })

  it('records write_failed with the message when the write throws', async () => {
    dbRows = many(2)
    snapshot.writeSnapshot.mockRejectedValue(new Error('boom'))
    await feedSearchFacts(new IndexAccumulator())
    await wait()
    const last = eventCreate.mock.calls.at(-1)![0] as { data: { properties: { phase: string; error?: string } } }
    expect(last.data.properties).toMatchObject({ phase: 'write_failed', error: 'boom' })
  })
})

describe('warmSearchIndex and the snapshot write', () => {
  it('stays pending until the write the load started is done, so after() keeps the instance alive for it', async () => {
    resetSearchIndexForTests()
    dbRows = many(2)
    let runWrite: () => Promise<void> = async () => undefined
    snapshot.inBackground.mockImplementation((task: () => Promise<void>) => {
      runWrite = task
    })
    let finishWrite: () => void = () => undefined
    snapshot.writeSnapshot.mockImplementation(() => new Promise<undefined>((resolve) => (finishWrite = () => resolve(undefined))))

    let warmed = false
    const warm = warmSearchIndex().then(() => {
      warmed = true
    })
    await wait()
    expect(warmed).toBe(false) // the index is built, the write has not run

    const running = runWrite()
    await wait()
    expect(snapshot.writeSnapshot).toHaveBeenCalledOnce()
    expect(warmed).toBe(false) // the write is under way

    finishWrite()
    await running
    await warm
    expect(warmed).toBe(true)
  })

  it('resolves at once when this load wrote nothing (the index came from the snapshot)', async () => {
    resetSearchIndexForTests()
    snapshot.snapshotUsable.mockReturnValue(true)
    snapshot.readParts.mockResolvedValue(JSON.parse(JSON.stringify([encodeFactsPart([fact('a')])])))
    await warmSearchIndex()
    expect(snapshot.writeSnapshot).not.toHaveBeenCalled()
  })

  it('still resolves when the write fails', async () => {
    resetSearchIndexForTests()
    dbRows = many(1)
    snapshot.writeSnapshot.mockRejectedValue(new Error('storage down'))
    await warmSearchIndex()
  })

  it('still resolves when the database read fails (the index is simply not there)', async () => {
    resetSearchIndexForTests()
    queryRaw.mockRejectedValueOnce(new Error('pool timeout'))
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await warmSearchIndex()
    errors.mockRestore()
  })
})
