import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/bearer-secret', () => ({ isBearerAuthorized: () => true }))
vi.mock('@/lib/email/notification-tier', () => ({ shouldSendWeeklyExtraForTier: () => true }))

const send = vi.fn(async () => ({ sent: true as const }))
vi.mock('@/lib/email/send-backchannel-match', () => ({ sendBackchannelMatchEmail: (...a: unknown[]) => send(...(a as [])) }))

const candidateFindMany = vi.fn()
const jobUpdate = vi.fn(async () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cronRun: { create: async () => ({ id: 'run' }), update: async () => ({}) },
    candidateProfile: { findMany: (...a: unknown[]) => candidateFindMany(...a) },
    supportNetworkContact: {
      findMany: async () => [
        { id: 'k1', name: 'Dana Lee', title: null, email: 'd@x.com', warmth: 'WARM', employmentStatusAtCompany: null, company: 'Acme', inferredCompany: null },
      ],
    },
    jobPosting: { update: (...a: unknown[]) => jobUpdate(...(a as [])) },
  },
}))

import { GET } from '@/app/api/cron/backchannel-match/route'

const candidate = (notified: Date | null) => ({
  id: 'c1',
  userId: 'u1',
  firstName: 'Justin',
  notificationTier: 'FULL',
  jobPostings: [{ id: 'j1', title: 'PM', companyName: 'Acme', appliedAt: new Date(), backchannelEmailSentAt: notified }],
})
const call = (qs: string) => GET(new NextRequest(`http://localhost/api/cron/backchannel-match${qs}`))

beforeEach(() => {
  vi.clearAllMocks()
  candidateFindMany.mockResolvedValue([candidate(null)])
})

describe('backchannel-match cron params', () => {
  it('limits the query to one candidate when candidateId is given', async () => {
    await call('?candidateId=c1')
    expect(candidateFindMany.mock.calls[0][0].where).toMatchObject({ id: 'c1' })
  })

  it('does not filter by candidate without candidateId', async () => {
    await call('')
    expect(candidateFindMany.mock.calls[0][0].where).not.toHaveProperty('id')
  })

  it('dry run reports the match but sends and marks nothing', async () => {
    const body = await (await call('?dryRun=1')).json()
    expect(body).toEqual({ checked: 1, dryRun: true, wouldSend: [{ candidateId: 'c1', jobId: 'j1', companyName: 'Acme', contactCount: 1 }] })
    expect(send).not.toHaveBeenCalled()
    expect(jobUpdate).not.toHaveBeenCalled()
  })

  it('skips already-notified applications unless force is set with candidateId', async () => {
    candidateFindMany.mockResolvedValue([candidate(new Date())])
    expect((await (await call('?candidateId=c1')).json()).sent).toBe(0)
    expect((await (await call('?candidateId=c1&force=1')).json()).sent).toBe(1)
  })

  it('rejects force without candidateId', async () => {
    const res = await call('?force=1')
    expect(res.status).toBe(400)
    expect(candidateFindMany).not.toHaveBeenCalled()
  })
})
