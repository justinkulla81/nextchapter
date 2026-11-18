import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ orgClaim: { findUnique: vi.fn(), update: vi.fn() }, orgWorkspace: { findFirst: vi.fn(), update: vi.fn() }, publicOrgPage: { findMany: vi.fn(async () => [] as { kind: string }[]) } }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const capture = vi.hoisted(() => vi.fn())
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: capture }))
const mail = vi.hoisted(() => ({ approved: vi.fn(async (_p: Record<string, unknown>) => true) }))
vi.mock('@/lib/email/send-org-claim-email', () => ({ sendOrgClaimLinkEmail: vi.fn(), sendOrgClaimAdminEmail: vi.fn(), sendHiringClaimApprovedEmail: mail.approved }))
const section = vi.hoisted(() => ({ applySectionClaim: vi.fn(async (_i: Record<string, unknown>) => ({ outcome: 'admin', section: 'hiring' })) }))
vi.mock('@/lib/org-claims/section-claim', () => section)
vi.mock('@/lib/crm/add-contact', () => ({ addContactToCrm: vi.fn() }))
const provision = vi.hoisted(() => ({ provisionFreeWorkspace: vi.fn(async (_i: Record<string, unknown>): Promise<{ ok: true; institutionId: string; slug: string; created: boolean } | { ok: false; error: string }> => ({ ok: true, institutionId: 'i1', slug: 'kentuckiana-works', created: true })) }))
vi.mock('@/lib/plans/provision', () => provision)

import { approveOrgClaim, declineOrgClaim } from '@/lib/org-claims/approval'

const claim = (over = {}) => ({
  id: 'c1', email: 'pat@board.gov', verifiedAt: new Date(), approvedAt: null as Date | null, declinedAt: null as Date | null, crmOrganizationId: 'o1',
  crmOrganization: { name: 'KentuckianaWorks', orgTypes: ['GOVERNMENT'] }, ...over,
})

describe('approving a claim', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens the free workspace with the claimant as administrator, then marks the claim approved', async () => {
    db.orgClaim.findUnique.mockResolvedValue(claim())
    expect(await approveOrgClaim('c1', 'owner@example.com')).toEqual({ ok: true, slug: 'kentuckiana-works' })
    expect(provision.provisionFreeWorkspace).toHaveBeenCalledWith({ crmOrganizationId: 'o1', name: 'KentuckianaWorks', orgType: 'GOVERNMENT', claimantEmail: 'pat@board.gov', unit: null })
    expect(db.orgClaim.update.mock.calls[0][0]).toMatchObject({ where: { id: 'c1' }, data: { approvedBy: 'owner@example.com' } })
    expect(capture).toHaveBeenCalledWith('org-claim:o1', 'org_claim_approved', expect.objectContaining({ claimId: 'c1', orgType: 'GOVERNMENT' }))
  })
  it('opens the economic development workspace for an organization linked to its economic development page', async () => {
    db.orgClaim.findUnique.mockResolvedValue(claim({ crmOrganization: { name: 'One Louisville', orgTypes: ['NONPROFIT', 'OTHER'] } }))
    db.publicOrgPage.findMany.mockResolvedValueOnce([{ kind: 'ECON_DEV' }])
    expect((await approveOrgClaim('c1', 'a')).ok).toBe(true)
    expect(provision.provisionFreeWorkspace).toHaveBeenCalledWith(expect.objectContaining({ name: 'One Louisville', orgType: 'ECONOMIC_DEVELOPMENT' }))
  })
  it('a university claim for one school opens that unit, not the whole institution', async () => {
    db.orgClaim.findUnique.mockResolvedValue(claim({ unitSchool: 'Tepper School of Business', unitDepartment: null, crmOrganization: { name: 'Carnegie Mellon University', orgTypes: ['UNIVERSITY'] } }))
    expect((await approveOrgClaim('c1', 'a')).ok).toBe(true)
    expect(provision.provisionFreeWorkspace.mock.calls[0][0]).toMatchObject({ orgType: 'UNIVERSITY', unit: { school: 'Tepper School of Business', department: null } })
  })
  it('leaves the claim open when the workspace could not be created, so it can be retried', async () => {
    db.orgClaim.findUnique.mockResolvedValue(claim())
    provision.provisionFreeWorkspace.mockResolvedValueOnce({ ok: false, error: 'no' })
    expect(await approveOrgClaim('c1', 'a')).toEqual({ ok: false, error: 'no' })
    expect(db.orgClaim.update).not.toHaveBeenCalled()
  })
  it('refuses unconfirmed, decided and no-workspace claims', async () => {
    db.orgClaim.findUnique.mockResolvedValue(claim({ verifiedAt: null }))
    expect((await approveOrgClaim('c1', 'a')).ok).toBe(false)
    db.orgClaim.findUnique.mockResolvedValue(claim({ approvedAt: new Date() }))
    expect((await approveOrgClaim('c1', 'a')).ok).toBe(false)
    db.orgClaim.findUnique.mockResolvedValue(claim({ declinedAt: new Date() }))
    expect((await approveOrgClaim('c1', 'a')).ok).toBe(false)
    db.orgClaim.findUnique.mockResolvedValue(claim({ crmOrganization: { name: 'Acme', orgTypes: ['EMPLOYER'] } }))
    expect((await approveOrgClaim('c1', 'a')).ok).toBe(false)
    expect(provision.provisionFreeWorkspace).not.toHaveBeenCalled()
  })
})

describe('declining a claim', () => {
  beforeEach(() => vi.clearAllMocks())
  it('records the decision and creates nothing', async () => {
    db.orgClaim.findUnique.mockResolvedValue(claim())
    expect(await declineOrgClaim('c1', 'owner@example.com')).toEqual({ ok: true })
    expect(db.orgClaim.update.mock.calls[0][0]).toMatchObject({ data: { declinedBy: 'owner@example.com' } })
    expect(provision.provisionFreeWorkspace).not.toHaveBeenCalled()
    expect(capture).toHaveBeenCalledWith('org-claim:o1', 'org_claim_declined', expect.objectContaining({ claimId: 'c1' }))
  })
  it('cannot decline an approved claim', async () => {
    db.orgClaim.findUnique.mockResolvedValue(claim({ approvedAt: new Date() }))
    expect((await declineOrgClaim('c1', 'a')).ok).toBe(false)
  })
})

describe('approving an employer claim', () => {
  const emp = (over = {}) => claim({ name: 'Pat Lee', title: 'Talent lead', emailDomain: 'acme.com', email: 'pat@acme.com', needsReview: false, section: 'hiring', outcome: 'ADMIN', crmOrganization: { name: 'Acme', orgTypes: ['EMPLOYER'], emailDomain: 'acme.com' }, ...over })
  beforeEach(() => {
    vi.clearAllMocks()
    db.orgWorkspace.findFirst.mockResolvedValue({ id: 'w1', status: 'PENDING', refId: null, inviteEmail: null })
  })
  it('opens the free hiring workspace: sets the claimant as its invite and emails them', async () => {
    db.orgClaim.findUnique.mockResolvedValue(emp())
    expect(await approveOrgClaim('c1', 'owner@example.com')).toEqual({ ok: true })
    expect(db.orgWorkspace.update.mock.calls[0][0]).toMatchObject({ where: { id: 'w1' }, data: { inviteEmail: 'pat@acme.com', plan: 'FREE' } })
    expect(mail.approved).toHaveBeenCalledWith(expect.objectContaining({ to: 'pat@acme.com', orgName: 'Acme' }))
    expect(db.orgClaim.update.mock.calls[0][0]).toMatchObject({ data: { approvedBy: 'owner@example.com' } })
    expect(provision.provisionFreeWorkspace).not.toHaveBeenCalled()
  })
  it('a claim held for review becomes the section admin first', async () => {
    db.orgClaim.findUnique.mockResolvedValue(emp({ outcome: 'REVIEW', needsReview: true }))
    expect(await approveOrgClaim('c1', 'a')).toEqual({ ok: true })
    expect(section.applySectionClaim).toHaveBeenCalledWith(expect.objectContaining({ needsReview: false, section: 'hiring' }))
  })
  it('a sales-led section is recorded, with no email and no workspace change', async () => {
    db.orgClaim.findUnique.mockResolvedValue(emp({ section: 'outplacement' }))
    expect(await approveOrgClaim('c1', 'a')).toEqual({ ok: true })
    expect(db.orgWorkspace.update).not.toHaveBeenCalled()
    expect(mail.approved).not.toHaveBeenCalled()
  })
})
