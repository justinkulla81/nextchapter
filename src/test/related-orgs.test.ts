import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  crmOrganization: { findUnique: vi.fn(), findMany: vi.fn() },
  institution: { findUnique: vi.fn() },
  ecosystemPartner: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const org = vi.hoisted(() => ({ uniqueClaimSlugs: vi.fn(async (s: string[]) => new Set(s)) }))
vi.mock('@/lib/org-claims/org', () => org)

import { addRelatedOrg, connectRelated, partnerKindFor, referralFor, relatedInviteUrl, searchClaimableOrgs } from '@/lib/org-claims/related-orgs'

const jcc = { id: 'o2', name: 'Jefferson Community College', canonicalNameNormalized: 'jefferson community college', orgTypes: ['UNIVERSITY'] }

describe('related organizations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.crmOrganization.findUnique.mockResolvedValue(jcc)
    db.institution.findUnique.mockResolvedValue(null)
    db.ecosystemPartner.findUnique.mockResolvedValue(null)
    db.ecosystemPartner.create.mockResolvedValue({ id: 'p1' })
  })
  it('maps CRM types to partner kinds and builds the claim invite', () => {
    expect(partnerKindFor(['UNIVERSITY'])).toBe('COLLEGE')
    expect(partnerKindFor(['EMPLOYER'])).toBe('EMPLOYER')
    expect(partnerKindFor([])).toBe('OTHER')
    expect(relatedInviteUrl('jefferson-community-college', 'tok')).toBe('https://launchyournextchapter.com/prepared/jefferson-community-college?via=tok')
  })
  it('searches by indexed name prefix, 25 at most, only organizations with a page, never itself', async () => {
    db.crmOrganization.findMany.mockResolvedValue([jcc])
    expect(await searchClaimableOrgs('Jefferson', 'o1')).toEqual([{ crmOrgId: 'o2', name: jcc.name, slug: 'jefferson-community-college', orgTypes: ['UNIVERSITY'] }])
    expect(db.crmOrganization.findMany.mock.calls[0][0]).toMatchObject({ where: { canonicalNameNormalized: { startsWith: 'jefferson' }, id: { not: 'o1' } }, take: 25 })
    expect(await searchClaimableOrgs('Je', null)).toEqual([])
    org.uniqueClaimSlugs.mockResolvedValueOnce(new Set())
    expect(await searchClaimableOrgs('Jefferson', null)).toEqual([])
  })
  it('links an organization with a page and returns its invite', async () => {
    const r = await addRelatedOrg({ institutionId: 'i1', institutionCrmOrgId: 'o1', crmOrgId: 'o2', createdBy: 'a@b.org' })
    expect(r).toMatchObject({ ok: true, partnerId: 'p1', alreadyOnNextChapter: false })
    expect(r.ok && r.inviteUrl).toMatch(/\/prepared\/jefferson-community-college\?via=/)
    expect(db.ecosystemPartner.create.mock.calls[0][0].data).toMatchObject({ institutionId: 'i1', source: 'CRM_ORG', refId: 'o2', crmOrganizationId: 'o2', kind: 'COLLEGE', status: 'INVITED' })
  })
  it('connects at once when the organization already has a portal', async () => {
    db.institution.findUnique.mockResolvedValue({ id: 'i2' })
    expect(await addRelatedOrg({ institutionId: 'i1', institutionCrmOrgId: 'o1', crmOrgId: 'o2', createdBy: 'a' })).toMatchObject({ ok: true, alreadyOnNextChapter: true })
    expect(db.ecosystemPartner.create.mock.calls[0][0].data).toMatchObject({ linkedInstitutionId: 'i2', status: 'CONFIRMED' })
  })
  it('refuses itself and organizations with no page', async () => {
    expect((await addRelatedOrg({ institutionId: 'i1', institutionCrmOrgId: 'o2', crmOrgId: 'o2', createdBy: 'a' })).ok).toBe(false)
    org.uniqueClaimSlugs.mockResolvedValueOnce(new Set())
    expect((await addRelatedOrg({ institutionId: 'i1', institutionCrmOrgId: 'o1', crmOrgId: 'o2', createdBy: 'a' })).ok).toBe(false)
    expect(db.ecosystemPartner.create).not.toHaveBeenCalled()
  })
  it('keeps an invite only for the organization it was made for', async () => {
    const token = 'x'.repeat(32)
    db.ecosystemPartner.findUnique.mockResolvedValue({ id: 'p1', crmOrganizationId: 'o2', institution: { name: 'KentuckianaWorks' } })
    expect(await referralFor(token, 'o2')).toEqual({ partnerId: 'p1', inviterName: 'KentuckianaWorks' })
    expect(await referralFor(token, 'o9')).toBeNull()
    expect(await referralFor('bad', 'o2')).toBeNull()
  })
  it('approval connects every organization that linked it', async () => {
    db.ecosystemPartner.updateMany.mockResolvedValue({ count: 2 })
    expect(await connectRelated({ crmOrgId: 'o2', institutionId: 'i2', referredByPartnerId: 'p1' })).toBe(2)
    expect(db.ecosystemPartner.updateMany.mock.calls[0][0]).toMatchObject({ where: { OR: [{ crmOrganizationId: 'o2' }, { id: 'p1' }], linkedInstitutionId: null }, data: { status: 'CONFIRMED', linkedInstitutionId: 'i2' } })
  })
})
