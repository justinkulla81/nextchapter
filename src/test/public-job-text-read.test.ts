import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const findUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { exclusiveJobPosting: { findUnique: (a: unknown) => findUnique(a) } } }))
vi.mock('@/lib/jobs/job-dismiss-server', () => ({ getConfirmedGhostIds: async () => new Set<string>() }))
vi.mock('@/lib/seo/job-titles', () => ({ getTitleDetail: vi.fn() }))
import { getPublicJob } from '@/lib/jobs/public-job-page-server'

const DAY = 86_400_000
const row = (over: Record<string, unknown> = {}) => ({
  id: 'job1234567890', title: 'Financial analyst', companyName: 'Acme', location: 'Austin, TX', url: 'https://example.com/j', status: 'approved',
  archivedAt: null, closeReason: null, expiresAt: null, lastVerifiedAt: new Date(Date.now() - DAY), createdAt: new Date(Date.now() - 2 * DAY),
  postedAt: null, disclosure: 'OPEN', distribution: 'OPEN', institutionScopeId: null, orgScopeId: null, source: 'ats_feed', employmentType: null,
  locationCountry: 'US', locationState: 'TX', locationCity: 'Austin', workArrangement: null, reopenCount: 0, repostCount: 0, directListing: true,
  sourceCategory: null, salaryMin: null, salaryMax: null, salaryCurrency: null, payPeriod: null, postingSignals: [], noExperiencePhrase: null,
  trainingPhrase: null, externalJobId: null, requisitionId: null, company: { website: null }, ...over,
})

describe('getPublicJob reads the posting text only for a job it shows', () => {
  beforeEach(() => findUnique.mockReset())
  it('never reads the text of a closed job', async () => {
    findUnique.mockResolvedValueOnce(row({ archivedAt: new Date() }))
    expect(await getPublicJob('job1234567890')).toBeNull()
    expect(findUnique).toHaveBeenCalledTimes(1)
    expect(findUnique.mock.calls[0][0].select.description).toBeUndefined()
  })
  it('reads the text of a live job and returns it', async () => {
    findUnique.mockResolvedValueOnce(row()).mockResolvedValueOnce({ description: 'x'.repeat(300) })
    const job = await getPublicJob('job1234567890')
    expect(job?.description).toHaveLength(300)
    expect(findUnique.mock.calls[1][0].select).toEqual({ description: true })
  })
  it('drops a live job whose text is too short', async () => {
    findUnique.mockResolvedValueOnce(row()).mockResolvedValueOnce({ description: 'short' })
    expect(await getPublicJob('job1234567890')).toBeNull()
  })
})

describe('getPublicJob keeps the posting text in the shared data cache', () => {
  it('asks the data cache for the text under one key per job, so a render after a deploy does not read it again', async () => {
    const nextCache = await import('next/cache')
    const spy = vi.spyOn(nextCache, 'unstable_cache')
    findUnique.mockReset().mockResolvedValueOnce(row()).mockResolvedValueOnce({ description: 'x'.repeat(300) })
    await getPublicJob('job1234567890')
    expect(spy.mock.calls.some((c) => (c[1] as string[]).includes('job-text:job1234567890'))).toBe(true)
  })
})
