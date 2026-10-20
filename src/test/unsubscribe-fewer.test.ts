import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const findUnique = vi.fn()
const update = vi.fn().mockResolvedValue({})
const updateMany = vi.fn().mockResolvedValue({ count: 1 })
vi.mock('@/lib/prisma', () => ({
  prisma: { candidateProfile: { findUnique: (...a: unknown[]) => findUnique(...a), update: (...a: unknown[]) => update(...a), updateMany: (...a: unknown[]) => updateMany(...a) } },
}))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/email/signed-links', () => ({ verifyLink: () => true }))

import { GET, POST } from '@/app/api/unsubscribe/[candidateId]/route'

const req = (qs: string, method = 'GET') => new NextRequest(`https://app.example.com/api/unsubscribe/cand1?${qs}`, { method })
const params = { params: Promise.resolve({ candidateId: 'cand1' }) }

beforeEach(() => {
  findUnique.mockReset()
  update.mockClear()
  updateMany.mockClear()
})

describe('unsubscribe page', () => {
  it('offers "send me fewer" to a full-tier member, without changing anything on GET', async () => {
    findUnique.mockResolvedValue({ notificationTier: 'FULL' })
    const html = await (await GET(req('type=daily&sig=x'), params)).text()
    expect(html).toContain('Send me fewer emails')
    expect(html).toContain('fewer=1')
    expect(html).toContain('Unsubscribe from these emails')
    expect(update).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('shows the plain confirmation to a member already on a lighter tier', async () => {
    findUnique.mockResolvedValue({ notificationTier: 'ESSENTIALS' })
    const html = await (await GET(req('type=daily&sig=x'), params)).text()
    expect(html).toContain('Confirm unsubscribe')
    expect(html).not.toContain('fewer=1')
  })

  it('does not offer fewer for non-recurring types', async () => {
    findUnique.mockResolvedValue({ notificationTier: 'FULL' })
    const html = await (await GET(req('type=recruiterUnlockNudge&sig=x'), params)).text()
    expect(html).toContain('Confirm unsubscribe')
  })
})

describe('unsubscribe POST', () => {
  it('"send me fewer" moves a full-tier member to Essentials and opts them out of nothing', async () => {
    await POST(req('type=daily&sig=x&fewer=1', 'POST'), params)
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'cand1', notificationTier: 'FULL' }, data: { notificationTier: 'ESSENTIALS' } })
    expect(update).not.toHaveBeenCalled()
  })

  it('a plain POST (including a mail client one-click unsubscribe) still opts out', async () => {
    await POST(req('type=daily&sig=x', 'POST'), params)
    expect(update).toHaveBeenCalledWith({ where: { id: 'cand1' }, data: { dailyEmailOptedOut: true } })
    expect(updateMany).not.toHaveBeenCalled()
  })
})
