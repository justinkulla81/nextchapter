import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
const findMany = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { exclusiveJobPosting: { findMany: (...a: unknown[]) => findMany(...a) } } }))
vi.mock('@/lib/jobs/public-job-page-server', () => ({ PUBLIC_JOB_LIST_SELECT: {}, withDescriptionStubs: async <T,>(rows: T[]) => rows }))
vi.mock('@/lib/jobs/job-dismiss-server', () => ({ getConfirmedGhostIds: async () => new Set<string>() }))
vi.mock('@/lib/jobs/public-job-page', () => ({ isPublicJob: (w: { id: string }) => !w.id.startsWith('gone') }))
const readBoardFigure = vi.fn()
vi.mock('@/lib/jobs/stored-board-figures', () => ({ readBoardFigure: (...a: unknown[]) => readBoardFigure(...a) }))

import { newestJobs, titlePlaceKeys } from '@/lib/seo/job-titles'

const row = (id: string) => ({ id, title: `T ${id}`, companyName: 'Acme', location: 'Austin, TX', postedAt: new Date('2026-11-01'), createdAt: new Date('2026-11-01'), salaryMin: null, salaryMax: null, payPeriod: null })
const ids = (n: number, prefix = 'j') => Array.from({ length: n }, (_, i) => `${prefix}${i}`)

beforeEach(() => {
  findMany.mockReset()
  findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map(row))
})

describe('newestJobs', () => {
  it('reads only the first limit + 5 ids when enough of them are public', async () => {
    const jobs = await newestJobs(ids(60), 15)
    expect(jobs.map((j) => j.id)).toEqual(ids(15))
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany.mock.calls[0][0].where.id.in).toHaveLength(20)
  })

  it('reads the rest, in order, when too few of the first are public', async () => {
    const list = [...ids(18, 'gone'), ...ids(42)]
    const jobs = await newestJobs(list, 15)
    expect(findMany).toHaveBeenCalledTimes(2)
    expect(jobs.map((j) => j.id)).toEqual(ids(15))
  })

  it('makes no second read when the list has nothing more', async () => {
    const jobs = await newestJobs(ids(10), 15)
    expect(jobs).toHaveLength(10)
    expect(findMany).toHaveBeenCalledTimes(1)
  })
})

describe('titlePlaceKeys', () => {
  it('holds every title-and-place pair that has a page as a "title:place" key', async () => {
    readBoardFigure.mockResolvedValue([['software-engineer', 'california', 'state', 982, 'California'], ['nurse', 'austin-tx', 'city', 40, 'Austin, TX']])
    const keys = await titlePlaceKeys()
    expect(keys.has('software-engineer:california')).toBe(true)
    expect(keys.has('nurse:austin-tx')).toBe(true)
    expect(keys.has('nurse:california')).toBe(false)
  })
})
