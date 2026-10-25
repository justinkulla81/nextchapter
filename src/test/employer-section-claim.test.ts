import { beforeEach, describe, expect, it, vi } from 'vitest'

type Ws = { id: string; refId: string | null; inviteEmail: string | null; status: string; admins: Array<{ email: string; role: string }> }

const db = vi.hoisted(() => ({
  orgClaim: { count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  crmOrganization: { findMany: vi.fn() },
  crmPerson: { update: vi.fn() },
  organization: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  orgWorkspace: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  orgWorkspaceAdmin: { create: vi.fn() },
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const capture = vi.hoisted(() => vi.fn())
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: capture }))
const mail = vi.hoisted(() => ({
  link: vi.fn(async (_p: Record<string, unknown>) => true),
  admin: vi.fn(async (_p: Record<string, unknown>) => true),
  request: vi.fn(async (_p: Record<string, unknown>) => true),
}))
vi.mock('@/lib/email/send-org-claim-email', () => ({ sendOrgClaimLinkEmail: mail.link, sendOrgClaimAdminEmail: mail.admin, sendSectionClaimRequestEmail: mail.request }))
const crm = vi.hoisted(() => ({ addContactToCrm: vi.fn(async (_c: Record<string, unknown>) => ({ outcome: 'added', personId: 'p1' })) }))
vi.mock('@/lib/crm/add-contact', () => crm)
vi.mock('@/lib/plans/provision', () => ({ provisionFreeWorkspace: vi.fn(async () => ({ ok: true })) }))

import { applySectionClaim, type SectionClaimInput } from '@/lib/org-claims/section-claim'
import { confirmOrgClaim, requestOrgClaim } from '@/lib/org-claims/claim'
import { newClaimToken } from '@/lib/org-claims/token'

const employer = { id: 'o1', name: 'Acme Corp', canonicalNameNormalized: 'acme corp', emailDomain: 'acme.com' as string | null, orgTypes: ['EMPLOYER'] }
const input: SectionClaimInput = {
  id: 'c1', crmOrganizationId: 'o1', orgName: 'Acme Corp', orgTypes: ['EMPLOYER'], orgDomain: 'acme.com', section: 'hiring',
  name: 'Pat Lee', title: 'Head of talent', email: 'pat@acme.com', emailDomain: 'acme.com', needsReview: false,
}

function workspace(over: Partial<Ws> = {}): Ws {
  return { id: 'w1', refId: null, inviteEmail: null, status: 'PENDING', admins: [], ...over }
}

describe('requestOrgClaim with a section', () => {
  const req = { slug: 'acme-corp', name: 'Pat Lee', title: 'Director', email: 'pat@acme.com', ip: '1.1.1.1' }
  beforeEach(() => {
    vi.clearAllMocks()
    db.crmOrganization.findMany.mockResolvedValue([employer])
    db.orgClaim.count.mockResolvedValue(0)
    db.orgClaim.create.mockResolvedValue({ id: 'c1' })
    db.orgClaim.updateMany.mockResolvedValue({ count: 0 })
  })

  it('stores the section and fires employer_section_claim_requested with what a query needs', async () => {
    expect(await requestOrgClaim({ ...req, section: 'employees' })).toMatchObject({ ok: true })
    expect(db.orgClaim.create.mock.calls[0][0].data.section).toBe('employees')
    expect(capture).toHaveBeenCalledWith('org-claim:o1', 'employer_section_claim_requested', expect.objectContaining({ orgId: 'o1', section: 'employees', claimId: 'c1', emailDomain: 'acme.com' }))
  })

  it('ignores a section that is not one of the three, and any section for a non-employer', async () => {
    await requestOrgClaim({ ...req, section: 'admin' })
    expect('section' in db.orgClaim.create.mock.calls[0][0].data).toBe(false)
    db.crmOrganization.findMany.mockResolvedValue([{ ...employer, orgTypes: ['UNIVERSITY'] }])
    await requestOrgClaim({ ...req, section: 'hiring' })
    expect('section' in db.orgClaim.create.mock.calls[1][0].data).toBe(false)
    expect(capture).not.toHaveBeenCalledWith(expect.anything(), 'employer_section_claim_requested', expect.anything())
  })

  it('does not touch the new column for a whole-page claim', async () => {
    await requestOrgClaim(req)
    expect('section' in db.orgClaim.create.mock.calls[0][0].data).toBe(false)
  })

  it('still stores the claim as a whole-page claim when the column is not applied yet', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.orgClaim.create.mockRejectedValueOnce(new Error('column "section" does not exist')).mockResolvedValueOnce({ id: 'c2' })
    expect(await requestOrgClaim({ ...req, section: 'hiring' })).toMatchObject({ ok: true })
    expect('section' in db.orgClaim.create.mock.calls[1][0].data).toBe(false)
    expect(mail.link).toHaveBeenCalledOnce()
  })
})

describe('applySectionClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.organization.findUnique.mockResolvedValue({ id: 'org1' })
    db.organization.findMany.mockResolvedValue([])
    db.orgWorkspace.findUnique.mockResolvedValue(null)
    db.orgWorkspace.create.mockResolvedValue(workspace())
    db.orgWorkspace.update.mockResolvedValue({})
    db.orgWorkspaceAdmin.create.mockResolvedValue({})
    db.orgClaim.updateMany.mockResolvedValue({ count: 1 })
  })

  it('makes the first claimant of an unclaimed section its admin, with the workspace pending', async () => {
    const r = await applySectionClaim({ ...input, section: 'employees' })
    expect(r).toEqual({ outcome: 'admin', section: 'employees' })
    expect(db.orgWorkspace.create.mock.calls[0][0].data).toMatchObject({ orgId: 'org1', type: 'EMPLOYEES', status: 'PENDING' })
    expect(db.orgWorkspaceAdmin.create.mock.calls[0][0].data).toMatchObject({ workspaceId: 'w1', email: 'pat@acme.com', role: 'ADMIN', source: 'DOMAIN_CLAIM' })
    expect(capture).toHaveBeenCalledWith('org-claim:o1', 'employer_section_claim_verified', expect.objectContaining({ section: 'employees', claimId: 'c1', outcome: 'admin' }))
    expect(db.orgClaim.updateMany).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { outcome: 'ADMIN' } })
  })

  it('creates the organization from the CRM record when there is none yet', async () => {
    db.organization.findUnique.mockResolvedValue(null)
    db.organization.create.mockResolvedValue({ id: 'org-new' })
    await applySectionClaim(input)
    expect(db.organization.create.mock.calls[0][0].data).toMatchObject({ name: 'Acme Corp', slug: 'acme-corp', domain: 'acme.com', crmOrganizationId: 'o1' })
    expect(db.orgWorkspace.create.mock.calls[0][0].data.orgId).toBe('org-new')
  })

  it('records the claimant as the hiring invite so signing up at /talent/signup activates the workspace', async () => {
    await applySectionClaim(input)
    expect(db.orgWorkspace.create.mock.calls[0][0].data).toMatchObject({ type: 'HIRING', inviteEmail: 'pat@acme.com', status: 'PENDING' })
  })

  it('never creates seats, a contract or an active outplacement workspace: a record and a staff lead only', async () => {
    const r = await applySectionClaim({ ...input, section: 'outplacement' })
    expect(r.outcome).toBe('admin')
    const data = db.orgWorkspace.create.mock.calls[0][0].data
    expect(data).toMatchObject({ type: 'OUTPLACEMENT', status: 'PENDING' })
    expect(data.refId).toBeUndefined()
    expect('inviteEmail' in data).toBe(false)
  })

  it('a later claimant of a section that has an admin becomes a request, never an admin', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(workspace({ status: 'ACTIVE', admins: [{ email: 'boss@acme.com', role: 'ADMIN' }, { email: 'viewer@acme.com', role: 'VIEWER' }] }))
    const r = await applySectionClaim({ ...input, email: 'new@acme.com', section: 'employees' })
    expect(r.outcome).toBe('requested')
    expect(db.orgWorkspaceAdmin.create).not.toHaveBeenCalled()
    expect(mail.request).toHaveBeenCalledTimes(1)
    expect(mail.request.mock.calls[0][0]).toMatchObject({ to: 'boss@acme.com', sectionLabel: 'Employees', email: 'new@acme.com' })
    expect(capture).toHaveBeenCalledWith('org-claim:o1', 'employer_section_claim_blocked_existing_admin', expect.objectContaining({ section: 'employees', adminsNotified: 1 }))
    expect(db.orgClaim.updateMany).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { outcome: 'REQUESTED' } })
  })

  it('treats a section that is linked to a portal record or invited as claimed, even with no admin row yet', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(workspace({ status: 'ACTIVE', refId: 'profile1' }))
    expect((await applySectionClaim(input)).outcome).toBe('requested')
    db.orgWorkspace.findUnique.mockResolvedValue(workspace({ inviteEmail: 'someone@acme.com' }))
    expect((await applySectionClaim(input)).outcome).toBe('requested')
    expect(db.orgWorkspaceAdmin.create).not.toHaveBeenCalled()
  })

  it('is idempotent for the same claimant', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(workspace({ admins: [{ email: 'PAT@acme.com', role: 'ADMIN' }] }))
    expect((await applySectionClaim(input)).outcome).toBe('admin')
    expect(db.orgWorkspaceAdmin.create).not.toHaveBeenCalled()
    expect(mail.request).not.toHaveBeenCalled()
  })

  it('creates nothing when there is no known domain: the team reviews it', async () => {
    expect((await applySectionClaim({ ...input, needsReview: true })).outcome).toBe('review')
    expect(db.organization.create).not.toHaveBeenCalled()
    expect(db.orgWorkspace.create).not.toHaveBeenCalled()
    expect(db.orgWorkspaceAdmin.create).not.toHaveBeenCalled()
  })

  it('skips organizations that are not employers', async () => {
    expect((await applySectionClaim({ ...input, orgTypes: ['UNIVERSITY'] })).outcome).toBe('skipped')
    expect(db.orgWorkspace.create).not.toHaveBeenCalled()
  })

  it('still answers when the outcome column is not applied yet', async () => {
    db.orgClaim.updateMany.mockRejectedValue(new Error('column "outcome" does not exist'))
    expect((await applySectionClaim(input)).outcome).toBe('admin')
  })
})

describe('confirmOrgClaim for a section claim', () => {
  const token = newClaimToken().token
  const row = {
    id: 'c1', crmOrganizationId: 'o1', name: 'Pat Lee', title: 'Director', email: 'pat@acme.com', emailDomain: 'acme.com', needsReview: false,
    expiresAt: new Date(Date.now() + 86_400_000), verifiedAt: null as Date | null,
    crmOrganization: { name: 'Acme Corp', canonicalNameNormalized: 'acme corp', orgTypes: ['EMPLOYER'], emailDomain: 'acme.com' },
  }
  beforeEach(() => {
    vi.clearAllMocks()
    db.orgClaim.updateMany.mockResolvedValue({ count: 1 })
    db.crmPerson.update.mockResolvedValue({})
    db.organization.findUnique.mockResolvedValue({ id: 'org1' })
    db.orgWorkspace.findUnique.mockResolvedValue(null)
    db.orgWorkspace.create.mockResolvedValue(workspace())
    db.orgWorkspaceAdmin.create.mockResolvedValue({})
  })

  it('keeps the CRM lead and the team email, and adds the section outcome to the result and the email', async () => {
    db.orgClaim.findUnique.mockResolvedValueOnce(row).mockResolvedValueOnce({ section: 'outplacement' })
    const r = await confirmOrgClaim(token)
    expect(r).toMatchObject({ status: 'verified', section: { key: 'outplacement', outcome: 'admin' } })
    expect(crm.addContactToCrm).toHaveBeenCalledOnce()
    expect(mail.admin).toHaveBeenCalledWith(expect.objectContaining({ section: { label: 'Outplacement', outcome: 'admin' } }))
  })

  it('verifies a claim exactly as before when the section column cannot be read', async () => {
    db.orgClaim.findUnique.mockResolvedValueOnce(row).mockRejectedValueOnce(new Error('column "section" does not exist'))
    const r = await confirmOrgClaim(token)
    expect(r).toMatchObject({ status: 'verified' })
    expect('section' in r).toBe(false)
    expect(db.orgWorkspace.create).not.toHaveBeenCalled()
    expect(crm.addContactToCrm).toHaveBeenCalledOnce()
  })

  it('never fails the claim if the section step throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.orgClaim.findUnique.mockResolvedValueOnce(row).mockResolvedValueOnce({ section: 'hiring' })
    db.organization.findUnique.mockRejectedValue(new Error('db down'))
    expect(await confirmOrgClaim(token)).toMatchObject({ status: 'verified' })
    expect(mail.admin).toHaveBeenCalledOnce()
  })
})
