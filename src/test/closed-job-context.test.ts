import { beforeEach, describe, expect, it, vi } from 'vitest'

// A job page for an id that exists must never answer 404 because a database read failed: the data cache keeps a 404 for days.
const db = vi.hoisted(() => ({ findUnique: vi.fn(), queryRaw: vi.fn(), titleDetail: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: { exclusiveJobPosting: { findUnique: db.findUnique, findMany: vi.fn().mockResolvedValue([]) }, $queryRaw: db.queryRaw } }))
vi.mock('@/lib/seo/job-titles', () => ({ getTitleDetail: db.titleDetail }))
vi.mock('@/lib/db/heavy', () => ({ memoTtl: (_ms: number, _k: unknown, fn: unknown) => fn, retryOnPoolTimeout: (fn: () => unknown) => fn(), sharedLoad: (_k: string, _s: number, fn: () => unknown) => fn() }))
vi.mock('@/lib/db/statement-timeout', () => ({ withStatementTimeout: (q: unknown) => q }))
vi.mock('@/lib/jobs/job-dismiss-server', () => ({ getConfirmedGhostIds: async () => new Set<string>() }))

import { getClosedJobContext } from '@/lib/jobs/public-job-page-server'

const row = { title: 'Paralegal', companyName: 'Acme', disclosure: 'OPEN', companyId: 'c1', locationCity: 'Austin', locationState: 'TX', location: 'Austin, TX', socCode: '23-2011', targetFunction: 'Legal', level: 'ENTRY_IC' }
const ID = 'cmvjqxv2602k9js09wgqpmgsg'

beforeEach(() => {
  db.findUnique.mockReset()
  db.queryRaw.mockReset().mockResolvedValue([])
  db.titleDetail.mockReset().mockResolvedValue(null)
})

describe('getClosedJobContext', () => {
  it('is null only when no such id exists', async () => {
    db.findUnique.mockResolvedValue(null)
    expect(await getClosedJobContext(ID)).toBeNull()
    expect(await getClosedJobContext('not an id')).toBeNull()
  })

  it('throws when the job itself cannot be read, so the page errors instead of caching a 404', async () => {
    db.findUnique.mockRejectedValue(new Error('canceling statement due to statement timeout'))
    await expect(getClosedJobContext(ID)).rejects.toThrow('statement timeout')
  })

  it('still answers for an existing job when the similar-jobs reads fail, with those lists empty', async () => {
    db.findUnique.mockResolvedValue(row)
    db.queryRaw.mockRejectedValue(new Error('canceling statement due to statement timeout'))
    db.titleDetail.mockRejectedValue(new Error('timeout'))
    const result = await getClosedJobContext(ID)
    expect(result).toMatchObject({ title: 'Paralegal', companyName: 'Acme', place: 'Austin, TX', similar: [], sameTitle: [] })
  })
})
