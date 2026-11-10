import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const queryRaw = vi.fn()
const eventCreate = vi.fn(async (..._a: unknown[]) => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a), analyticsEvent: { create: (...a: unknown[]) => eventCreate(...a) } } }))

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
}))

import { readSearchFacts, resetSearchIndexForTests, warmSearchIndex, type FactsRow } from '@/lib/jobs/board-search-index'
import { decodeFacts, encodeFactsPart, FACTS_PART_ROWS } from '@/lib/jobs/board-snapshot-codec'

const fact = (id: string): FactsRow => ({
  id, title: `Analyst ${id}`, companyName: 'Acme', industry: null, socTitle: null, workArrangement: null,
  locationCity: null, locationState: 'TX', states: null, skills: null, postingType: null,
})

beforeEach(() => {
  Object.values(snapshot).forEach((f) => f.mockClear())
  queryRaw.mockReset()
  eventCreate.mockClear()
  snapshot.snapshotsDisabled.mockReturnValue(false)
  snapshot.boardFingerprint.mockResolvedValue('fp1')
  snapshot.readManifest.mockResolvedValue({ kind: 'search-facts', at: Date.now(), fingerprint: 'fp1', parts: ['p0'], rows: 2 })
})

describe('readSearchFacts', () => {
  it('reads the shared snapshot and never the database when one is usable', async () => {
    snapshot.snapshotUsable.mockReturnValue(true)
    snapshot.readParts.mockResolvedValue(JSON.parse(JSON.stringify([encodeFactsPart([fact('a'), fact('b')])])))
    const rows = await readSearchFacts()
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(queryRaw).not.toHaveBeenCalled()
    expect(snapshot.writeSnapshot).not.toHaveBeenCalled()
  })

  it('reads the database and writes the next snapshot when none is usable', async () => {
    snapshot.snapshotUsable.mockReturnValue(false)
    queryRaw.mockResolvedValue([fact('a'), fact('b'), fact('c')])
    const rows = await readSearchFacts()
    expect(rows).toHaveLength(3)
    expect(queryRaw).toHaveBeenCalledOnce()
    await new Promise((r) => setTimeout(r, 20)) // the write starts after its "start" row is recorded
    expect(snapshot.writeSnapshot).toHaveBeenCalledOnce()
    const [kind, fingerprint, , parts, count] = snapshot.writeSnapshot.mock.calls[0] as unknown as [string, string, number, (() => unknown)[], number]
    expect([kind, fingerprint, count]).toEqual(['search-facts', 'fp1', 3])
    // Parts are built when written, not up front: functions, one per FACTS_PART_ROWS rows.
    expect(parts).toHaveLength(1)
    expect(typeof parts[0]).toBe('function')
    expect(decodeFacts([parts[0]()])!.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('falls back to the database when the snapshot parts cannot be read or are in another format', async () => {
    snapshot.snapshotUsable.mockReturnValue(true)
    queryRaw.mockResolvedValue([fact('a')])
    snapshot.readParts.mockResolvedValue(null)
    expect(await readSearchFacts()).toHaveLength(1)
    snapshot.readParts.mockResolvedValue([{ v: 9 }])
    expect(await readSearchFacts()).toHaveLength(1)
    expect(queryRaw).toHaveBeenCalledTimes(2)
  })

  it('falls back to the database when the storage read throws', async () => {
    snapshot.readManifest.mockRejectedValue(new Error('storage down'))
    queryRaw.mockResolvedValue([fact('a')])
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await readSearchFacts()).toHaveLength(1)
    errors.mockRestore()
  })

  it('does not touch storage, and writes nothing, when snapshots are off', async () => {
    snapshot.snapshotsDisabled.mockReturnValue(true)
    queryRaw.mockResolvedValue([fact('a')])
    expect(await readSearchFacts()).toHaveLength(1)
    expect(snapshot.readManifest).not.toHaveBeenCalled()
    expect(snapshot.writeSnapshot).not.toHaveBeenCalled()
  })

  it('writes no snapshot when the board version is unreadable or the read is empty', async () => {
    snapshot.snapshotUsable.mockReturnValue(false)
    snapshot.boardFingerprint.mockResolvedValue(null)
    queryRaw.mockResolvedValue([fact('a')])
    await readSearchFacts()
    expect(snapshot.writeSnapshot).not.toHaveBeenCalled()
    snapshot.boardFingerprint.mockResolvedValue('fp1')
    queryRaw.mockResolvedValue([])
    await readSearchFacts()
    expect(snapshot.writeSnapshot).not.toHaveBeenCalled()
  })
})

describe('warmSearchIndex and the snapshot write', () => {
  it('stays pending until the write the load started is done, so after() keeps the instance alive for it', async () => {
    resetSearchIndexForTests()
    snapshot.snapshotUsable.mockReturnValue(false)
    queryRaw.mockResolvedValue([fact('a'), fact('b')])
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
    await new Promise((r) => setTimeout(r, 20))
    expect(warmed).toBe(false) // the index is built, the write has not run

    const running = runWrite()
    await new Promise((r) => setTimeout(r, 20))
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
    snapshot.snapshotUsable.mockReturnValue(false)
    queryRaw.mockResolvedValue([fact('a')])
    snapshot.writeSnapshot.mockRejectedValue(new Error('storage down'))
    snapshot.inBackground.mockImplementation((task: () => Promise<void>) => void task().catch(() => undefined))
    await warmSearchIndex()
  })
})

describe('the write is recorded step by step', () => {
  beforeEach(() => {
    snapshot.writeSnapshot.mockReset()
    snapshot.writeSnapshot.mockResolvedValue(undefined)
  })

  const phases = () => eventCreate.mock.calls.map((c) => (c[0] as { data: { event: string; properties: { phase: string } } }).data).filter((d) => d.event === 'search_facts_snapshot_written').map((d) => d.properties.phase)

  it('records start and done when the manifest reads back as this write', async () => {
    resetSearchIndexForTests()
    snapshot.snapshotUsable.mockReturnValue(false)
    queryRaw.mockResolvedValue([fact('a')])
    snapshot.readManifest.mockResolvedValue(null) // none to read before the database read...
    snapshot.inBackground.mockImplementation((task: () => Promise<void>) => void task())
    snapshot.readManifest.mockResolvedValueOnce(null).mockResolvedValue({ kind: 'search-facts', fingerprint: 'fp1', at: Date.now(), parts: [], rows: 1 })
    await warmSearchIndex()
    expect(phases()).toEqual(['start', 'done'])
  })

  it('records failed when the write left no manifest for this version (writeSnapshot logs its own errors and returns)', async () => {
    resetSearchIndexForTests()
    snapshot.snapshotUsable.mockReturnValue(false)
    queryRaw.mockResolvedValue([fact('a')])
    snapshot.inBackground.mockImplementation((task: () => Promise<void>) => void task())
    snapshot.readManifest.mockResolvedValue(null)
    await warmSearchIndex()
    expect(phases()).toEqual(['start', 'failed'])
  })

  it('records failed with the message when the write throws, and still lets the warm-up finish', async () => {
    resetSearchIndexForTests()
    snapshot.snapshotUsable.mockReturnValue(false)
    queryRaw.mockResolvedValue([fact('a')])
    snapshot.inBackground.mockImplementation((task: () => Promise<void>) => void task())
    snapshot.readManifest.mockResolvedValue(null)
    snapshot.writeSnapshot.mockRejectedValue(new Error('boom'))
    await warmSearchIndex()
    const last = eventCreate.mock.calls.at(-1)![0] as { data: { properties: { phase: string; error?: string } } }
    expect(last.data.properties).toMatchObject({ phase: 'failed', error: 'boom' })
  })

  it('splits a large read into parts of FACTS_PART_ROWS rows', async () => {
    resetSearchIndexForTests()
    snapshot.snapshotUsable.mockReturnValue(false)
    snapshot.inBackground.mockImplementation((task: () => Promise<void>) => void task())
    snapshot.readManifest.mockResolvedValue(null)
    snapshot.writeSnapshot.mockResolvedValue(undefined)
    queryRaw.mockResolvedValue(Array.from({ length: FACTS_PART_ROWS * 2 + 5 }, (_, i) => fact(`r${i}`)))
    await readSearchFacts()
    await new Promise((r) => setTimeout(r, 20))
    const parts = (snapshot.writeSnapshot.mock.calls[0] as unknown as [string, string, number, (() => unknown)[], number])[3]
    expect(parts).toHaveLength(3)
    expect(decodeFacts([parts[2]()])).toHaveLength(5)
  })
})
