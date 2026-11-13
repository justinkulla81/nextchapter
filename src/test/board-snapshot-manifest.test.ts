import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { isOtherBuild, readManifest, snapshotUsable, writeSnapshot, SHARED_ACROSS_BUILDS, SNAPSHOT_SHAPES, type SnapshotManifest } from '@/lib/jobs/board-snapshot'

const MIN = 60_000
const NOW = Date.UTC(2026, 10, 9, 18, 0)

function manifest(over: Partial<SnapshotManifest> = {}): SnapshotManifest {
  return { v: 2, build: 'build-old', kind: 'occupations', fingerprint: 'fp1', at: NOW - 5 * MIN, parts: ['x'], rows: 10, shape: 'occupations-1', ...over }
}

/** A storage bucket in memory: GET returns an object, POST stores it, DELETE and the listing do nothing. */
function fakeStorage(initial: Record<string, unknown> = {}) {
  const store = new Map<string, string>(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]))
  const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: unknown }) => {
    const path = url.replace(/^.*\/object\/board-snapshots\//, '').replace(/\?.*$/, '')
    if (url.includes('/object/list/')) return new Response('[]', { status: 200 })
    if (init?.method === 'POST') {
      store.set(path, Buffer.from(init.body as Uint8Array).toString('latin1'))
      return new Response('{}', { status: 200 })
    }
    if (init?.method === 'DELETE') return new Response('{}', { status: 200 })
    const hit = store.get(path)
    return hit === undefined ? new Response('not found', { status: 404 }) : new Response(hit, { status: 200 })
  })
  return { store, fetchMock }
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'build-new')
  vi.stubEnv('BOARD_SNAPSHOT', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('readManifest across builds', () => {
  it('serves a build-independent kind written by another build when the shape matches', async () => {
    const { fetchMock } = fakeStorage({ 'production/occupations/manifest.json': manifest() })
    vi.stubGlobal('fetch', fetchMock)
    const m = await readManifest('occupations')
    expect(m?.build).toBe('build-old')
    expect(isOtherBuild(m!)).toBe(true)
  })

  it('ignores one written in another shape, and one written before shapes existed', async () => {
    const wrong = fakeStorage({ 'production/occupations/manifest.json': manifest({ shape: 'occupations-0' }) })
    vi.stubGlobal('fetch', wrong.fetchMock)
    expect(await readManifest('occupations')).toBeNull()
    const { shape: _s, ...legacy } = manifest()
    const old = fakeStorage({ 'production/occupations/manifest.json': legacy })
    vi.stubGlobal('fetch', old.fetchMock)
    expect(await readManifest('occupations')).toBeNull()
  })

  it('serves the search facts the same way', async () => {
    const { fetchMock } = fakeStorage({ 'production/search-facts/manifest.json': manifest({ kind: 'search-facts', shape: 'search-facts-1' }) })
    vi.stubGlobal('fetch', fetchMock)
    expect((await readManifest('search-facts'))?.kind).toBe('search-facts')
  })

  it('still reads the board kinds only from the build that wrote them', async () => {
    const other = fakeStorage({ 'production/board-core/manifest.json': manifest({ kind: 'board-core', shape: undefined }) })
    vi.stubGlobal('fetch', other.fetchMock)
    expect(await readManifest('board-core')).toBeNull()
    const same = fakeStorage({ 'production/board-core/manifest.json': manifest({ kind: 'board-core', build: 'build-new', shape: undefined }) })
    vi.stubGlobal('fetch', same.fetchMock)
    expect((await readManifest('board-core'))?.build).toBe('build-new')
  })

  it('rejects a manifest of another kind or format', async () => {
    const { fetchMock } = fakeStorage({ 'production/occupations/manifest.json': manifest({ kind: 'search-facts' }) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await readManifest('occupations')).toBeNull()
    const { fetchMock: f2 } = fakeStorage({ 'production/occupations/manifest.json': manifest({ v: 1 }) })
    vi.stubGlobal('fetch', f2)
    expect(await readManifest('occupations')).toBeNull()
  })
})

describe('writeSnapshot', () => {
  it('stamps a build-independent kind with its shape and leaves the board kinds without one', async () => {
    const a = fakeStorage()
    vi.stubGlobal('fetch', a.fetchMock)
    await writeSnapshot('search-facts', 'fp-a', NOW, [{ v: 1, ids: [], strings: [] }], 0)
    const written = JSON.parse(a.store.get('production/search-facts/manifest.json')!)
    expect(written).toMatchObject({ kind: 'search-facts', shape: SNAPSHOT_SHAPES['search-facts'], build: 'build-new' })

    const b = fakeStorage()
    vi.stubGlobal('fetch', b.fetchMock)
    await writeSnapshot('board-core', 'fp-b', NOW, [{}], 1)
    expect(JSON.parse(b.store.get('production/board-core/manifest.json')!).shape).toBeUndefined()
  })

  it('builds a part that is given as a function only when its turn comes, one at a time', async () => {
    const a = fakeStorage()
    vi.stubGlobal('fetch', a.fetchMock)
    const order: string[] = []
    const posted = () => a.fetchMock.mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === 'POST' && !String(c[0]).includes('/list/')).length
    const part = (name: string) => () => {
      order.push(`${name}@${posted()}`) // how many uploads had happened when this part was built
      return { name }
    }
    await writeSnapshot('search-facts', 'fp-c', NOW, [part('p0'), part('p1'), { name: 'plain' }], 3)
    expect(order).toEqual(['p0@0', 'p1@1'])
    const written = JSON.parse(a.store.get('production/search-facts/manifest.json')!)
    expect(written.parts).toHaveLength(3)
    expect(JSON.parse(gunzipSync(Buffer.from(a.store.get(written.parts[0])!, 'latin1')).toString())).toEqual({ name: 'p0' })
  })

  it('names a shape for every build-independent kind', () => {
    for (const kind of SHARED_ACROSS_BUILDS) expect(SNAPSHOT_SHAPES[kind], kind).toBeTruthy()
  })
})

describe('snapshotUsable', () => {
  const env = { VERCEL_GIT_COMMIT_SHA: 'build-new' }
  const use = (m: SnapshotManifest, fp: string | null, other?: number) => snapshotUsable(m, fp, { freshMs: 10 * MIN, otherBuildMaxMs: other, now: NOW, env })

  it('uses a fresh snapshot, or an older one while the board has not changed', () => {
    expect(use(manifest({ build: 'build-new', at: NOW - 5 * MIN }), null)).toBe(true)
    expect(use(manifest({ build: 'build-new', at: NOW - 3 * 60 * MIN }), 'fp1')).toBe(true)
    expect(use(manifest({ build: 'build-new', at: NOW - 3 * 60 * MIN }), 'fp2')).toBe(false)
    expect(use(manifest({ build: 'build-new', at: NOW - 3 * 60 * MIN }), null)).toBe(false)
  })

  it('serves a refresh of the shared board from a snapshot up to three minutes old, changed board or not (board-shortlist.ts)', () => {
    const board = (m: SnapshotManifest, fp: string | null) => snapshotUsable(m, fp, { freshMs: 3 * MIN, now: NOW, env })
    expect(board(manifest({ kind: 'board-core', build: 'build-new', at: NOW - 2 * MIN, fingerprint: 'old' }), 'new')).toBe(true)
    expect(board(manifest({ kind: 'board-core', build: 'build-new', at: NOW - 4 * MIN, fingerprint: 'old' }), 'new')).toBe(false)
    expect(board(manifest({ kind: 'board-core', build: 'build-new', at: NOW - 4 * MIN, fingerprint: 'same' }), 'same')).toBe(true)
  })

  it('holds another build\'s snapshot to the shorter limit, whatever the board did', () => {
    expect(use(manifest({ at: NOW - 20 * MIN }), 'fp1', 30 * MIN)).toBe(true)
    expect(use(manifest({ at: NOW - 45 * MIN }), 'fp1', 30 * MIN)).toBe(false)
  })

  it('treats another build like this one when no separate limit is given (the raw search facts)', () => {
    expect(use(manifest({ at: NOW - 3 * 60 * MIN }), 'fp1')).toBe(true)
    expect(use(manifest({ at: NOW - 3 * 60 * MIN }), 'fp2')).toBe(false)
  })
})
