import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { capture, addCompany, prismaMock } = vi.hoisted(() => ({
  capture: vi.fn(),
  addCompany: vi.fn(async () => ({}) as { error?: string }),
  prismaMock: {
    candidateProfile: { findFirst: vi.fn() },
    company: { findUnique: vi.fn(async () => ({ name: 'Intel Corporation' })) },
    homepageLead: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: capture }))
vi.mock('@/lib/company-tracker/watchlist', () => ({ addCompanyToWatchlist: addCompany }))

import { claimEmployerFollows, followFromConfirmedLead } from '@/lib/company-tracker/follow-from-email'

const lead = { email: 'a@b.com', kind: 'job_alert', source: 'page:employer', searchQ: 'intel corporation' }

beforeEach(() => {
  vi.clearAllMocks()
  addCompany.mockResolvedValue({})
})

describe('followFromConfirmedLead', () => {
  it('follows the company, by its display name, for a member with that email', async () => {
    prismaMock.candidateProfile.findFirst.mockResolvedValue({ id: 'c1' })
    expect(await followFromConfirmedLead(lead)).toBe(true)
    expect(addCompany).toHaveBeenCalledWith('c1', 'Intel Corporation')
    expect(capture).toHaveBeenCalledWith('c1', 'company_followed', expect.objectContaining({ via: 'confirm_click' }))
  })
  it('does nothing when no member has the email', async () => {
    prismaMock.candidateProfile.findFirst.mockResolvedValue(null)
    expect(await followFromConfirmedLead(lead)).toBe(false)
    expect(addCompany).not.toHaveBeenCalled()
  })
  it('ignores signups that did not come from an employer page', async () => {
    expect(await followFromConfirmedLead({ ...lead, source: 'jobs' })).toBe(false)
    expect(prismaMock.candidateProfile.findFirst).not.toHaveBeenCalled()
  })
})

describe('claimEmployerFollows', () => {
  it('follows each live employer-page signup made with the email', async () => {
    prismaMock.homepageLead.findMany.mockResolvedValue([{ searchQ: 'intel corporation' }, { searchQ: 'acme' }])
    expect(await claimEmployerFollows('c1', 'A@B.com')).toBe(2)
    expect(prismaMock.homepageLead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ email: 'a@b.com', source: 'page:employer', unsubscribedAt: null }) }))
  })
  it('does not count one that is already followed', async () => {
    prismaMock.homepageLead.findMany.mockResolvedValue([{ searchQ: 'acme' }])
    addCompany.mockResolvedValue({ error: 'Acme is already on your watchlist.' })
    expect(await claimEmployerFollows('c1', 'a@b.com')).toBe(0)
  })
  it('returns 0 without an email', async () => {
    expect(await claimEmployerFollows('c1', null)).toBe(0)
  })
})
