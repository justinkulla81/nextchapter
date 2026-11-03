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

import { showRecruiterAsk } from '@/lib/jobs/recruiter-ask'
import { saveRecruiterInterest } from '@/lib/leads/recruiter-interest-actions'

const job = (title: string, level?: string) => ({ title, description: null, companyName: 'Acme', level })

describe('showRecruiterAsk', () => {
  it('shows director and up at a big company', () => {
    expect(showRecruiterAsk(job('Director of Finance'), 'LARGE')).toBe(true)
    expect(showRecruiterAsk(job('Chief Financial Officer'), 'MEGA')).toBe(true)
  })
  it('needs VP or higher at a small or unknown-size company', () => {
    expect(showRecruiterAsk(job('Director of Finance'), 'SMALL')).toBe(false)
    expect(showRecruiterAsk(job('Director of Finance'), null)).toBe(false)
    expect(showRecruiterAsk(job('Vice President, Finance'), 'SMALL')).toBe(true)
    expect(showRecruiterAsk(job('Vice President, Finance'), null)).toBe(true)
  })
  it('never shows below director', () => {
    expect(showRecruiterAsk(job('Senior Manager, Finance'), 'MEGA')).toBe(false)
    expect(showRecruiterAsk(job('Accountant'), 'MEGA')).toBe(false)
  })
  it('trusts ncrawl level when the title is vague', () => {
    expect(showRecruiterAsk(job('Finance Leader', 'VP'), 'SMALL')).toBe(true)
  })
})

describe('saveRecruiterInterest', () => {
  const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
  beforeEach(() => { vi.clearAllMocks(); prismaMock.homepageLead.findUnique.mockResolvedValue(null) })

  it('keeps what was typed when the email is bad', async () => {
    const r = await saveRecruiterInterest(undefined, form({ space: 'Finance', email: 'nope' }))
    expect(r?.error).toMatch(/email/i)
    expect(r?.email).toBe('nope')
    expect(prismaMock.homepageLead.create).not.toHaveBeenCalled()
  })
  it('saves the space against the email and fires the event', async () => {
    const r = await saveRecruiterInterest(undefined, form({ space: 'Finance', email: 'A@B.com', company: 'Acme', jobId: 'abcdefghij12' }))
    expect(r).toEqual({ saved: true, email: 'a@b.com' })
    expect(prismaMock.homepageLead.create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: 'a@b.com', kind: 'recruiter_interest', searchQ: 'finance', source: 'page:job' }) })
    expect(capture).toHaveBeenCalledWith('a@b.com', 'recruiter_interest_saved', expect.objectContaining({ jobId: 'abcdefghij12', space: 'Finance' }))
  })
  it('stores nothing for a bot', async () => {
    const r = await saveRecruiterInterest(undefined, form({ space: 'Finance', email: 'a@b.com', website: 'x' }))
    expect(r).toEqual({ saved: true })
    expect(prismaMock.homepageLead.create).not.toHaveBeenCalled()
  })
})
