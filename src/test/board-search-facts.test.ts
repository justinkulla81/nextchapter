import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const queryRaw = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) } }))

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

import { readSearchFacts, type FactsRow } from '@/lib/jobs/board-search-index'
import { encodeFactsPart } from '@/lib/jobs/board-snapshot-codec'

const fact = (id: string): FactsRow => ({
  id, title: `Analyst ${id}`, companyName: 'Acme', industry: null, socTitle: null, workArrangement: null,
  locationCity: null, locationState: 'TX', states: null, skills: null, postingType: null,
})

beforeEach(() => {
  Object.values(snapshot).forEach((f) => f.mockClear())
  queryRaw.mockReset()
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
    expect(snapshot.writeSnapshot).toHaveBeenCalledOnce()
    const [kind, fingerprint, , parts, count] = snapshot.writeSnapshot.mock.calls[0] as unknown as [string, string, number, unknown[], number]
    expect([kind, fingerprint, count]).toEqual(['search-facts', 'fp1', 3])
    expect(parts).toHaveLength(1)
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
