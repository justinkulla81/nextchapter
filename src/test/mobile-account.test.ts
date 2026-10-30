import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  allow: vi.fn(async () => true),
  user: vi.fn(),
  signIn: vi.fn(),
  profile: vi.fn(),
  update: vi.fn(),
  delSaved: vi.fn(),
  delDev: vi.fn(),
  help: vi.fn(),
  notify: vi.fn(),
  notifyPortal: vi.fn(),
}))
vi.mock('@/lib/security/rate-limit', () => ({ allowByIp: m.allow, HOUR_MS: 3600000 }))
vi.mock('@/lib/mobile/auth', () => ({ mobileUser: m.user }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { signInWithPassword: m.signIn } }) }))
vi.mock('@/lib/help/notify', () => ({ notifyAdminOfHelp: m.notify, notifyAdminOfPortalHelp: m.notifyPortal }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    candidateProfile: { findUnique: m.profile, update: m.update },
    mobileSavedSearch: { deleteMany: m.delSaved },
    mobileDevice: { deleteMany: m.delDev },
    helpRequest: { create: m.help },
  },
}))
import { POST } from '@/app/api/mobile/account/route'

const post = (body: unknown) => new NextRequest('https://launchyournextchapter.com/api/mobile/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  m.allow.mockResolvedValue(true)
  m.user.mockResolvedValue({ id: 'u1', email: 'a@b.com' })
  m.signIn.mockResolvedValue({ error: null })
  m.profile.mockResolvedValue({ id: 'c1' })
  m.help.mockResolvedValue({ id: 'h1' })
})

describe('POST /api/mobile/account', () => {
  it('needs sign-in, the word DELETE and the password', async () => {
    m.user.mockResolvedValueOnce(null)
    expect((await POST(post({ confirm: 'DELETE', password: 'x' }))).status).toBe(401)
    expect((await POST(post({ confirm: 'no', password: 'x' }))).status).toBe(400)
    expect((await POST(post({ confirm: 'DELETE' }))).status).toBe(400)
    expect(m.update).not.toHaveBeenCalled()
  })
  it('does nothing when the password is wrong', async () => {
    m.signIn.mockResolvedValue({ error: { message: 'bad' } })
    expect((await POST(post({ confirm: 'delete', password: 'nope' }))).status).toBe(403)
    expect(m.update).not.toHaveBeenCalled()
    expect(m.delDev).not.toHaveBeenCalled()
  })
  it('deactivates, clears app data and opens a Help request', async () => {
    const res = await POST(post({ confirm: 'DELETE', password: 'pw' }))
    expect(res.status).toBe(200)
    expect(m.delSaved).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    expect(m.delDev).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    expect(m.update.mock.calls[0][0].where).toEqual({ id: 'c1' })
    expect(m.update.mock.calls[0][0].data.deactivatedAt).toBeInstanceOf(Date)
    expect(m.notify).toHaveBeenCalled()
  })
  it('still files the request for an account with no candidate profile', async () => {
    m.profile.mockResolvedValue(null)
    expect((await POST(post({ confirm: 'DELETE', password: 'pw' }))).status).toBe(200)
    expect(m.update).not.toHaveBeenCalled()
    expect(m.help.mock.calls[0][0].data.requesterEmail).toBe('a@b.com')
    expect(m.notifyPortal).toHaveBeenCalled()
  })
})
