import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const db = vi.hoisted(() => ({
  institutions: [] as { id: string; slug: string; crmId: string; data: Record<string, unknown> }[],
  staff: [] as { institutionId: string; invitedEmail: string; role: string }[],
  invites: 0,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    institution: {
      findUnique: async ({ where }: { where: Record<string, string> }) => db.institutions.find((i) => i['crmId'] === where['crmOrganizationId']) ?? null,
      findMany: async () => db.institutions.map((i) => ({ slug: i.slug })),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `inst_${db.institutions.length + 1}`, slug: data.slug as string, crmId: data['crmOrganizationId'] as string, data }
        db.institutions.push(row)
        return { id: row.id, slug: row.slug }
      },
    },
    institutionUser: {
      findFirst: async ({ where }: { where: { institutionId: string; invitedEmail: string; role: string } }) =>
        db.staff.find((s) => s.institutionId === where.institutionId && s.invitedEmail === where.invitedEmail && s.role === where.role) ?? null,
    },
  },
}))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: () => {} }))
vi.mock('@/lib/institution/invite', () => ({
  inviteInstitutionUser: async (i: { institutionSlug: string; email: string; role: string }) => {
    db.invites++
    const inst = db.institutions.find((x) => x.slug === i.institutionSlug)!
    db.staff.push({ institutionId: inst.id, invitedEmail: i.email, role: i.role })
    return { acceptUrl: 'https://example.test/accept' }
  },
}))

import { institutionOrgTypeFor, provisionFreeWorkspace } from './provision'

const input = { crmOrganizationId: 'crm_1', name: 'Riverside Workforce Board', orgType: 'WORKFORCE_BOARD', claimantEmail: 'Ana@Riverside.org ' }

beforeEach(() => {
  db.institutions.length = 0
  db.staff.length = 0
  db.invites = 0
})

describe('provisionFreeWorkspace', () => {
  it('creates a FREE, CAREER-tier workspace with 50 seats and an administrator seat for the claimant', async () => {
    const r = await provisionFreeWorkspace(input)
    expect(r).toMatchObject({ ok: true, created: true, slug: 'riverside-workforce-board' })
    expect(db.institutions[0].data).toMatchObject({ plan: 'FREE', tier: 'CAREER', includedSeats: 50, orgType: 'WORKFORCE_BOARD', crmOrganizationId: 'crm_1' })
    expect(db.staff).toEqual([{ institutionId: 'inst_1', invitedEmail: 'ana@riverside.org', role: 'INSTITUTION_ADMIN' }])
  })

  it('is idempotent per crmOrganizationId: no second workspace, no second invite', async () => {
    const a = await provisionFreeWorkspace(input)
    const b = await provisionFreeWorkspace({ ...input, name: 'Different name' })
    expect(b).toMatchObject({ ok: true, created: false })
    expect(a.ok && b.ok && a.institutionId === b.institutionId).toBe(true)
    expect(db.institutions).toHaveLength(1)
    expect(db.invites).toBe(1)
  })

  it('gives a different record with the same name its own slug', async () => {
    await provisionFreeWorkspace(input)
    const r = await provisionFreeWorkspace({ ...input, crmOrganizationId: 'crm_2' })
    expect(r).toMatchObject({ ok: true, created: true, slug: 'riverside-workforce-board-2' })
  })

  it('refuses a missing name or a bad email without creating anything', async () => {
    expect((await provisionFreeWorkspace({ ...input, name: ' ' })).ok).toBe(false)
    expect((await provisionFreeWorkspace({ ...input, claimantEmail: 'nope' })).ok).toBe(false)
    expect(db.institutions).toHaveLength(0)
  })
})

describe('institutionOrgTypeFor', () => {
  it('maps CRM types: university is higher education, the rest workforce', () => {
    expect(institutionOrgTypeFor('UNIVERSITY')).toBe('COLLEGE')
    expect(institutionOrgTypeFor('COLLEGE')).toBe('COLLEGE')
    expect(institutionOrgTypeFor('GOVERNMENT')).toBe('WORKFORCE_BOARD')
    expect(institutionOrgTypeFor('WORKFORCE_PROVIDER')).toBe('COMMUNITY_ORG')
    expect(institutionOrgTypeFor('CHAMBER')).toBe('CHAMBER')
  })
})
