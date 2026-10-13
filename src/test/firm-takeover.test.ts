import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const db = vi.hoisted(() => ({
  recruiterFirm: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  recruiter: { findUnique: vi.fn(), update: vi.fn() },
  recruiterFirmInvite: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`)
  },
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
const sendInvite = vi.hoisted(() => vi.fn(async () => ({ sent: true })))
vi.mock('@/lib/email/send-intake', () => ({ sendRecruiterFirmInvite: sendInvite }))
vi.mock('@/lib/recruiter/intake/pipeline', () => ({ draftReply: vi.fn() }))
vi.mock('@/lib/recruiter/intake/replies', () => ({ sendApprovedReply: vi.fn() }))

let ctx: Record<string, unknown>
vi.mock('@/lib/recruiter/intake/access', () => ({
  getTalentContext: async () => ctx,
  canManageFirm: (c: { firm?: unknown; role?: string }) => !!c.firm && c.role === 'ADMIN',
  canAssign: () => false,
  findVisibleConnection: vi.fn(),
  visibleConnectionsWhere: vi.fn(),
}))

import { acceptFirmInvite, createTalentFirm, inviteRecruiterToFirm } from '@/app/recruiters/(app)/talent/actions'
import { emailMayClaimFirm } from '@/lib/recruiter/firm-invite'

const form = (o: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}
const me = { id: 'r-me', userId: 'u-me', fullName: 'Me Recruiter', workEmail: 'me@acme.com', intakeSlug: null }

beforeEach(() => {
  vi.clearAllMocks()
  ctx = { recruiter: me, firm: null, role: null }
})

describe('createTalentFirm', () => {
  it('does not hand over an existing firm because its name was typed', async () => {
    db.recruiterFirm.findUnique.mockImplementation(async ({ where }: { where: { slug?: string; name?: string } }) =>
      where.name ? { id: 'f-existing' } : null,
    )
    const res = await createTalentFirm(undefined, form({ name: 'Globex Partners', slug: 'globex-partners' }))
    expect(res?.error).toMatch(/already on NextChapter/)
    expect(db.recruiter.update).not.toHaveBeenCalled()
    expect(db.recruiterFirm.update).not.toHaveBeenCalled()
  })

  it('creates a fresh firm when the name is free', async () => {
    db.recruiterFirm.findUnique.mockResolvedValue(null)
    db.recruiterFirm.create.mockResolvedValue({ id: 'f-new' })
    await expect(createTalentFirm(undefined, form({ name: 'Fresh Search', slug: 'fresh-search' }))).rejects.toThrow('REDIRECT:/recruiters/talent/setup')
    expect(db.recruiter.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ recruiterFirmId: 'f-new', firmRole: 'ADMIN' }) }))
  })
})

describe('inviteRecruiterToFirm', () => {
  beforeEach(() => {
    ctx = { recruiter: me, firm: { id: 'f1', name: 'Acme Search' }, role: 'ADMIN' }
    db.recruiterFirmInvite.upsert.mockResolvedValue({ id: 'inv1', token: 'tok1' })
  })

  it('never moves an existing recruiter: they get an invite to accept', async () => {
    db.recruiter.findUnique.mockResolvedValue({ id: 'r-victim', workEmail: 'victim@else.com', recruiterFirmId: null, firmRole: null })
    const res = await inviteRecruiterToFirm(undefined, form({ email: 'victim@else.com', role: 'ADMIN' }))
    expect(res?.success).toMatch(/when they accept/)
    expect(db.recruiter.update).not.toHaveBeenCalled()
    expect(db.recruiterFirmInvite.update).not.toHaveBeenCalled()
    expect(sendInvite).toHaveBeenCalledWith(expect.objectContaining({ existingAccount: true, token: 'tok1' }))
  })

  it('sends new people the signup link', async () => {
    db.recruiter.findUnique.mockResolvedValue(null)
    await inviteRecruiterToFirm(undefined, form({ email: 'new@person.com', role: 'RECRUITER' }))
    expect(sendInvite).toHaveBeenCalledWith(expect.not.objectContaining({ existingAccount: true }))
  })
})

describe('acceptFirmInvite', () => {
  const invite = { id: 'inv1', token: 'tok1', email: 'me@acme.com', role: 'RECRUITER', firmId: 'f1', acceptedAt: null, firm: { id: 'f1', name: 'Acme Search' } }

  it('joins the signed-in recruiter whose address was invited', async () => {
    db.recruiterFirmInvite.findUnique.mockResolvedValue(invite)
    await expect(acceptFirmInvite('tok1')).rejects.toThrow('REDIRECT:/recruiters/talent')
    expect(db.recruiter.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'r-me' }, data: expect.objectContaining({ recruiterFirmId: 'f1', firmRole: 'RECRUITER' }) }))
  })

  it("refuses someone else's invitation", async () => {
    db.recruiterFirmInvite.findUnique.mockResolvedValue({ ...invite, email: 'someone@else.com' })
    const res = await acceptFirmInvite('tok1')
    expect(res?.error).toMatch(/sent to someone@else.com/)
    expect(db.recruiter.update).not.toHaveBeenCalled()
  })

  it('refuses a used invitation and a recruiter who is already on a firm', async () => {
    db.recruiterFirmInvite.findUnique.mockResolvedValue({ ...invite, acceptedAt: new Date() })
    expect((await acceptFirmInvite('tok1'))?.error).toMatch(/no longer valid/)
    ctx = { recruiter: me, firm: { id: 'other' }, role: 'RECRUITER' }
    expect((await acceptFirmInvite('tok1'))?.error).toMatch(/already belong/)
    expect(db.recruiter.update).not.toHaveBeenCalled()
  })
})

describe('emailMayClaimFirm', () => {
  it('allows anyone when no contact is on file (the link decides)', () => {
    expect(emailMayClaimFirm('x@y.com', null)).toBe(true)
  })
  it('allows the contact and colleagues on the same company domain', () => {
    expect(emailMayClaimFirm('ann@acme-search.com', 'ann@acme-search.com')).toBe(true)
    expect(emailMayClaimFirm('bob@acme-search.com', 'ann@acme-search.com')).toBe(true)
    expect(emailMayClaimFirm('bob@mail.acme-search.com', 'ann@acme-search.com')).toBe(true)
  })
  it('refuses other companies and look-alike domains', () => {
    expect(emailMayClaimFirm('eve@evil.com', 'ann@acme-search.com')).toBe(false)
    expect(emailMayClaimFirm('eve@acme-search.com.evil.com', 'ann@acme-search.com')).toBe(false)
  })
  it('needs the exact address when the contact uses personal mail', () => {
    expect(emailMayClaimFirm('ann@gmail.com', 'ann@gmail.com')).toBe(true)
    expect(emailMayClaimFirm('eve@gmail.com', 'ann@gmail.com')).toBe(false)
  })
})
