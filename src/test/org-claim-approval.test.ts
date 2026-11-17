import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ orgClaim: { findUnique: vi.fn(), update: vi.fn() } }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const capture = vi.hoisted(() => vi.fn())
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: capture }))
vi.mock('@/lib/email/send-org-claim-email', () => ({ sendOrgClaimLinkEmail: vi.fn(), sendOrgClaimAdminEmail: vi.fn() }))
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
    expect(provision.provisionFreeWorkspace).toHaveBeenCalledWith({ crmOrganizationId: 'o1', name: 'KentuckianaWorks', orgType: 'GOVERNMENT', claimantEmail: 'pat@board.gov' })
    expect(db.orgClaim.update.mock.calls[0][0]).toMatchObject({ where: { id: 'c1' }, data: { approvedBy: 'owner@example.com' } })
    expect(capture).toHaveBeenCalledWith('org-claim:o1', 'org_claim_approved', expect.objectContaining({ claimId: 'c1', orgType: 'GOVERNMENT' }))
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
