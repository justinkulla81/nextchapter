import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { capture, prismaMock } = vi.hoisted(() => ({
  capture: vi.fn(),
  prismaMock: { homepageLead: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: capture }))
vi.mock('@/lib/http/client-ip', () => ({ getClientIp: async () => '1.2.3.4' }))
vi.mock('@/lib/security/rate-limit', () => ({ allowByIp: async () => true, allowByTarget: async () => true, DAY_MS: 1, HOUR_MS: 1 }))
vi.mock('@/lib/leads/notify-new-lead', () => ({ notifyNewLead: vi.fn() }))

import { flagCompanyInterest } from '@/lib/leads/company-interest-actions'

const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
beforeEach(() => { vi.clearAllMocks(); prismaMock.homepageLead.findUnique.mockResolvedValue(null) })

describe('flagCompanyInterest', () => {
  it('requires an email and keeps what was typed', async () => {
    const r = await flagCompanyInterest(undefined, form({ company: 'Intel', email: 'nope' }))
    expect(r?.error).toMatch(/email/i)
    expect(r?.email).toBe('nope')
    expect(prismaMock.homepageLead.create).not.toHaveBeenCalled()
  })
  it('saves the company against the email and fires the event', async () => {
    const r = await flagCompanyInterest(undefined, form({ company: 'Intel Corporation', email: 'A@B.com', page: 'layoffs', slug: 'intel' }))
    expect(r).toEqual({ saved: true, email: 'a@b.com' })
    expect(prismaMock.homepageLead.create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: 'a@b.com', kind: 'company_interest', searchQ: 'intel corporation', source: 'page:layoffs' }) })
    expect(capture).toHaveBeenCalledWith('a@b.com', 'company_interest_flagged', expect.objectContaining({ companyName: 'Intel Corporation', slug: 'intel', page: 'layoffs' }))
  })
  it('does not store anything for a bot', async () => {
    const r = await flagCompanyInterest(undefined, form({ company: 'Intel', email: 'a@b.com', website: 'x' }))
    expect(r).toEqual({ saved: true })
    expect(prismaMock.homepageLead.create).not.toHaveBeenCalled()
  })
})
