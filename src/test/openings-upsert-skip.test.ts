import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const exec = vi.fn(async (..._a: unknown[]) => 0)
const findMany = vi.fn()
const queryRaw = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { $executeRawUnsafe: (...a: unknown[]) => exec(...a), exclusiveJobPosting: { findMany: (...a: unknown[]) => findMany(...a) }, $queryRaw: (...a: unknown[]) => queryRaw(...a) } }))
vi.mock('@/lib/jobs/job-dismiss-server', () => ({ getConfirmedGhostIds: async () => new Set(['ghost000001']) }))

import { upsertOpenings } from '@/lib/companies/job-openings'
import { publicJobLabels } from '@/lib/jobs/public-job-page-server'

describe('upsertOpenings', () => {
  it('rewrites a held row only when something would change or it was last seen over a day before', async () => {
    await upsertOpenings([{ url: 'https://x' } as never])
    const sql = String(exec.mock.calls[0][0])
    expect(sql).toMatch(/DO UPDATE SET[\s\S]*WHERE EXCLUDED\."lastSeenAt" > "CompanyJobOpening"\."lastSeenAt" \+ interval '1 day'/)
    // A close or a reopen always writes.
    expect(sql).toContain('EXCLUDED."closedAt" IS DISTINCT FROM "CompanyJobOpening"."closedAt"')
    expect(sql).toContain('(EXCLUDED."closedAt" IS NULL AND "CompanyJobOpening"."closeReason" IS NOT NULL)')
    // Every field the update can change is compared.
    for (const col of ['companyId', 'title', 'companyName', 'location', 'states', 'isRemote', 'level', 'seniorityGroup', 'function', 'industry', 'salaryMin', 'salaryMax', 'salaryCurrency', 'payAnnualMin', 'payAnnualMax', 'payAnnualMid', 'postedAt', 'sourceName']) {
      expect(sql, col).toContain(`EXCLUDED."${col}" IS DISTINCT FROM "CompanyJobOpening"."${col}"`)
    }
  })
})

describe('publicJobLabels', () => {
  it('labels the jobs that still have a public page, in one read without the posting text', async () => {
    const now = new Date()
    const base = { status: 'approved', archivedAt: null, closeReason: null, expiresAt: null, lastVerifiedAt: now, createdAt: now, postedAt: now, disclosure: 'OPEN', distribution: 'OPEN', institutionScopeId: null, orgScopeId: null, source: 'ats_feed', employmentType: null, locationCountry: 'US', locationState: 'TX', locationCity: 'Austin', workArrangement: null, reopenCount: 0, repostCount: 0, directListing: true, sourceCategory: 'employer', location: 'Austin, TX', url: 'https://jobs.example.com/1' }
    findMany.mockResolvedValue([
      { ...base, id: 'live0000001', title: 'Analyst', companyName: 'Acme Inc' },
      { ...base, id: 'ghost000001', title: 'Ghost', companyName: 'Acme' },
      { ...base, id: 'closed00001', title: 'Closed', companyName: 'Acme', closeReason: 'filled' },
    ])
    queryRaw.mockImplementation(async () => (findMany.mock.results[0] ? [{ id: 'live0000001', d: 'x'.repeat(300) }, { id: 'ghost000001', d: 'x'.repeat(300) }, { id: 'closed00001', d: 'x'.repeat(300) }] : []))
    const labels = await publicJobLabels(['live0000001', 'ghost000001', 'closed00001', 'live0000001', 'bad id'])
    expect([...labels.keys()]).toEqual(['live0000001'])
    expect(labels.get('live0000001')).toMatch(/^Analyst at Acme/)
    expect(findMany).toHaveBeenCalledTimes(1)
    const select = (findMany.mock.calls[0][0] as { select: Record<string, unknown> }).select
    expect(select.description).toBeUndefined()
  })
})
