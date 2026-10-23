import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  candidateProfile: { findUnique: vi.fn() },
  partnerLink: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
const sendEmail = vi.hoisted(() => vi.fn(async () => true))
vi.mock('@/lib/email/send-partner-email', () => ({ sendPartnerInviteEmail: sendEmail }))

import { acceptPartnerInvite, invitePartner, pendingInviteFor } from '@/lib/partner-search/partner'

beforeEach(() => {
  vi.clearAllMocks()
  db.candidateProfile.findUnique.mockResolvedValue({ firstName: 'Dana', confidentialSearchMode: false })
  db.partnerLink.findFirst.mockResolvedValue(null)
  db.partnerLink.upsert.mockResolvedValue({ id: 'l1' })
})

const sharing = { sharePlaces: true, shareJobsPay: true }

describe('invitePartner', () => {
  it('sends the invite and stores what the partner may see', async () => {
    const r = await invitePartner('c1', 'dana@example.com', 'Sam', ' Sam@Example.com ', { sharePlaces: true, shareJobsPay: false })
    expect(r).toEqual({ ok: true })
    expect(db.partnerLink.upsert.mock.calls[0][0].create).toMatchObject({ ownerId: 'c1', partnerEmail: 'sam@example.com', shareJobsPay: false })
    expect(sendEmail).toHaveBeenCalledOnce()
  })
  it('refuses your own email, a bad email and a missing name, and says what to do', async () => {
    expect((await invitePartner('c1', 'dana@example.com', 'Dana', 'DANA@example.com', sharing))).toMatchObject({ ok: false, error: expect.stringContaining('your own email') })
    expect((await invitePartner('c1', null, 'Sam', 'not-an-email', sharing))).toMatchObject({ ok: false, error: expect.stringContaining('does not look right') })
    expect((await invitePartner('c1', null, ' ', 'sam@example.com', sharing))).toMatchObject({ ok: false, error: expect.stringContaining('name') })
    expect(sendEmail).not.toHaveBeenCalled()
  })
  it('shares nothing in confidential mode', async () => {
    db.candidateProfile.findUnique.mockResolvedValue({ firstName: 'Dana', confidentialSearchMode: true })
    const r = await invitePartner('c1', null, 'Sam', 'sam@example.com', sharing)
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('Confidential mode') })
    expect(db.partnerLink.upsert).not.toHaveBeenCalled()
  })
  it('allows one partner at a time', async () => {
    db.partnerLink.findFirst.mockResolvedValue({ id: 'x', ownerId: 'c1', partnerId: null, partnerName: 'Pat', partnerEmail: 'pat@example.com', sharePlaces: true, shareJobsPay: true, owner: { firstName: 'Dana' }, partner: null })
    const r = await invitePartner('c1', null, 'Sam', 'sam@example.com', sharing)
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('already have a partner') })
  })
})

describe('accepting an invitation', () => {
  const open = { partnerEmail: 'sam@example.com', partnerId: null, revokedAt: null, ownerId: 'c1' }
  it('needs the account email to match the invited email', async () => {
    db.partnerLink.findUnique.mockResolvedValue(open)
    expect((await acceptPartnerInvite('c2', 'someone@else.com', 'l1')).ok).toBe(false)
    expect((await acceptPartnerInvite('c2', null, 'l1')).ok).toBe(false)
    expect(db.partnerLink.update).not.toHaveBeenCalled()
  })
  it('links the account when the email matches', async () => {
    db.partnerLink.findUnique.mockResolvedValue(open)
    expect(await acceptPartnerInvite('c2', 'SAM@example.com', 'l1')).toEqual({ ok: true })
    expect(db.partnerLink.update.mock.calls[0][0].data).toMatchObject({ partnerId: 'c2' })
  })
  it('does not reopen a removed or already used invitation, or let you accept your own', async () => {
    db.partnerLink.findUnique.mockResolvedValue({ ...open, revokedAt: new Date() })
    expect((await acceptPartnerInvite('c2', 'sam@example.com', 'l1')).ok).toBe(false)
    db.partnerLink.findUnique.mockResolvedValue({ ...open, partnerId: 'c9' })
    expect((await acceptPartnerInvite('c2', 'sam@example.com', 'l1')).ok).toBe(false)
    db.partnerLink.findUnique.mockResolvedValue(open)
    expect((await acceptPartnerInvite('c1', 'sam@example.com', 'l1')).ok).toBe(false)
  })
})

describe('pendingInviteFor', () => {
  it('looks up by the lower-cased email and nothing else', async () => {
    db.partnerLink.findFirst.mockResolvedValue({ id: 'l1', owner: { firstName: 'Dana' } })
    expect(await pendingInviteFor(' Sam@Example.com ')).toEqual({ id: 'l1', ownerFirstName: 'Dana' })
    expect(db.partnerLink.findFirst.mock.calls[0][0].where).toMatchObject({ partnerEmail: 'sam@example.com', partnerId: null, revokedAt: null })
    expect(await pendingInviteFor(null)).toBeNull()
  })
})
