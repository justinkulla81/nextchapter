import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))
const queryRaw = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a), topicSnapshot: {} } }))
const limits: number[] = []
vi.mock('@/lib/db/statement-timeout', () => ({ withStatementTimeout: (q: Promise<unknown>, ms: number) => (limits.push(ms), q) }))
vi.mock('@/lib/branding/store', () => ({ getOrgBrand: vi.fn() }))
vi.mock('@/lib/jobs/public-job-page-server', async () => {
  const { Prisma } = await import('@prisma/client')
  return { PUBLIC_JOB_LIST_SELECT: {}, PUBLIC_JOB_STATIC_SQL: Prisma.sql`s = 1`, PUBLIC_JOB_LIVE_SQL: Prisma.sql`l = 1`, withDescriptionStubs: vi.fn() }
})
vi.mock('@/lib/jobs/job-dismiss-server', () => ({ getConfirmedGhostIds: vi.fn() }))
vi.mock('@/lib/org-claims/org', () => ({ resolveClaimableOrg: vi.fn() }))
vi.mock('@/lib/seo/topic-snapshot', () => ({ persisted: vi.fn(), storeNow: vi.fn() }))

import { FIRM_COMPANY_BATCH, loadFirmListings } from '@/lib/seo/search-firm-pages'

const firm = (n: number, o: Record<string, unknown> = {}) => ({ oid: `o${n}`, canon: `acme staffing ${String.fromCharCode(97 + (n % 26))}${Math.floor(n / 26)}`, fname: `Firm ${n}`, fname2: null, cid: `c${n}`, segment: null, staffing: true, recruiter: true, types: ['SEARCH_FIRM'], ...o })
const posting = (id: string, extra: Record<string, unknown> = {}) => ({ jid: id, fn: 'Finance', state: 'NY', industry: null, level: 'MID', verified: new Date('2026-11-10'), ...extra })

beforeEach(() => {
  queryRaw.mockReset()
  limits.length = 0
})

describe('loadFirmListings stages', () => {
  it('reads firms, then crawled postings, then companies in batches, and joins them', async () => {
    const firms = Array.from({ length: 250 }, (_, i) => firm(i))
    const crawled = [1, 2, 3, 4].map((n) => posting(`x${n}`, { sname: 'Firm 0' })).concat(posting('y', { sname: 'Nobody' }))
    queryRaw
      .mockResolvedValueOnce(firms)
      .mockResolvedValueOnce(crawled)
      .mockResolvedValueOnce([posting('p1', { cid: 'c0' })]) // batch 1 (c0..c99)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    const list = await loadFirmListings()
    // 3 batches of 100, 100, 50 companies
    expect(queryRaw).toHaveBeenCalledTimes(2 + Math.ceil(250 / FIRM_COMPANY_BATCH))
    expect(limits.length).toBe(5)
    // Firm 0 has five public roles (four crawled + one by company), the minimum, so it is the only one listed
    expect(list.map((f) => f.name)).toEqual(['Firm 0'])
    expect(list[0].publicRoles).toBe(5)
  })

  it('fails the whole load when a stage fails (nothing half-built is returned)', async () => {
    queryRaw.mockResolvedValueOnce([firm(1)]).mockRejectedValueOnce(new Error('canceling statement due to statement timeout'))
    await expect(loadFirmListings()).rejects.toThrow(/statement timeout/)
  })

  it('counts a posting once when a firm matches by both its board name and its company', async () => {
    const ids = [1, 2, 3, 4, 5]
    queryRaw
      .mockResolvedValueOnce([firm(1, { fname2: 'Firm 1' })])
      .mockResolvedValueOnce(ids.map((n) => posting(`p${n}`, { sname: 'Firm 1' })))
      .mockResolvedValueOnce(ids.map((n) => posting(`p${n}`, { cid: 'c1' })))
    const list = await loadFirmListings()
    expect(list).toHaveLength(1)
    expect(list[0].publicRoles).toBe(5)
  })
})
