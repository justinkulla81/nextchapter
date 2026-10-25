import { describe, expect, it, vi } from 'vitest'
import { getEmployerAccess, type EmployerAccessDb } from '@/lib/employer/access'
import { compareAccess, legacyGrants, runDiff } from '../../scripts/employer/access-diff-lib'
import { readOnlyDb, ReadOnlyViolation } from '../../scripts/employer/read-only-db'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

type Fake = {
  profile?: { id: string } | null
  seat?: { role: 'OWNER' | 'MEMBER'; employerId: string } | null
  orgUser?: { role: 'ADMIN' | 'VIEWER' | 'LEGAL' | 'FINANCE'; orgId: string } | null
  contracts?: Array<'GROWTH' | 'LEARNING' | 'OUTPLACEMENT'>
  admins?: Array<{ role: string; workspace: { id: string; orgId: string; type: string; refId: string | null; plan: string; services: unknown; org: { enterprise: boolean } } }>
}

function fakeDb(f: Fake): EmployerAccessDb {
  const contracts = f.contracts ?? []
  return {
    employerProfile: { findUnique: async () => f.profile ?? null },
    employerSeat: { findFirst: async () => f.seat ?? null },
    outplacementOrgUser: { findUnique: async () => f.orgUser ?? null },
    outplacementContract: {
      findMany: async () => [...new Set(contracts.filter((c) => c !== 'OUTPLACEMENT'))].map((programType) => ({ programType })),
      count: async () => contracts.filter((c) => c !== 'OUTPLACEMENT').length,
    },
    orgWorkspaceAdmin: { findMany: async () => f.admins ?? [] },
  } as unknown as EmployerAccessDb
}

describe('getEmployerAccess', () => {
  it('gives a hiring owner Hiring with the ADMIN role', async () => {
    const a = await getEmployerAccess({ userId: 'u' }, fakeDb({ profile: { id: 'p1' } }))
    expect(a.sections).toEqual(['hiring'])
    expect(a.grants[0]).toMatchObject({ section: 'hiring', role: 'ADMIN', legacyRole: 'OWNER', recordId: 'p1' })
  })

  it('maps an accepted hiring MEMBER seat to VIEWER', async () => {
    const a = await getEmployerAccess({ userId: 'u' }, fakeDb({ seat: { role: 'MEMBER', employerId: 'p2' } }))
    expect(a.grants[0]).toMatchObject({ section: 'hiring', role: 'VIEWER', legacyRole: 'MEMBER' })
  })

  it('gives an outplacement ADMIN Outplacement, and Employees only with a GROWTH or LEARNING contract', async () => {
    const none = await getEmployerAccess({ userId: 'u' }, fakeDb({ orgUser: { role: 'ADMIN', orgId: 'o' }, contracts: ['OUTPLACEMENT'] }))
    expect(none.sections).toEqual(['outplacement'])
    const both = await getEmployerAccess({ userId: 'u' }, fakeDb({ orgUser: { role: 'VIEWER', orgId: 'o' }, contracts: ['GROWTH', 'LEARNING'] }))
    expect(both.sections).toEqual(['employees', 'outplacement'])
    expect(both.grants.find((g) => g.section === 'employees')?.services).toEqual({ learning: true, retention: true, retraining: false })
  })

  it('does not give LEGAL or FINANCE the Employees section, as the Growth and Learning pages do not', async () => {
    const a = await getEmployerAccess({ userId: 'u' }, fakeDb({ orgUser: { role: 'LEGAL', orgId: 'o' }, contracts: ['GROWTH'] }))
    expect(a.sections).toEqual(['outplacement'])
  })

  it('adds workspace admin rows on top and never removes the legacy grants', async () => {
    const db = fakeDb({
      orgUser: { role: 'ADMIN', orgId: 'o' },
      admins: [{ role: 'BILLING', workspace: { id: 'w', orgId: 'org1', type: 'HIRING', refId: null, plan: 'FREE', services: {}, org: { enterprise: true } } }],
    })
    const a = await getEmployerAccess({ userId: 'u', email: 'A@B.com' }, db)
    expect(a.sections).toEqual(['hiring', 'outplacement'])
    expect(a.grants.map((g) => g.source)).toEqual(['outplacement_org_user', 'workspace_admin'])
    expect(a.grants[1]).toMatchObject({ role: 'BILLING', enterprise: true, organizationId: 'org1', workspaceId: 'w' })
  })

  it('returns nothing for a person who holds nothing', async () => {
    const a = await getEmployerAccess({ userId: 'u' }, fakeDb({}))
    expect(a).toEqual({ userId: 'u', sections: [], grants: [] })
  })
})

describe('the access diff', () => {
  it('finds no difference when the new access covers the legacy access', async () => {
    const db = fakeDb({ profile: { id: 'p' }, orgUser: { role: 'ADMIN', orgId: 'o' }, contracts: ['GROWTH'] })
    const r = await runDiff(db, ['u'], (userId) => getEmployerAccess({ userId }, db))
    expect(r.differences).toEqual([])
    expect(r.usersWithAccess).toBe(1)
    expect(r.addedGrants).toBe(0)
  })

  it('reports a legacy grant the new access dropped', async () => {
    const db = fakeDb({ orgUser: { role: 'ADMIN', orgId: 'o' } })
    const legacy = await legacyGrants(db, 'u')
    expect(compareAccess('u', legacy, { userId: 'u', sections: [], grants: [] })?.missing).toEqual([{ section: 'outplacement', role: 'ADMIN', recordId: 'o' }])
  })

  it('counts grants added by the new table', async () => {
    const db = fakeDb({ admins: [{ role: 'ADMIN', workspace: { id: 'w', orgId: 'x', type: 'EMPLOYEES', refId: null, plan: 'FREE', services: { learning: true }, org: { enterprise: false } } }] })
    const r = await runDiff(db, ['u'], (userId) => getEmployerAccess({ userId }, db))
    expect(r.addedGrants).toBe(1)
    expect(r.differences).toEqual([])
  })
})

describe('readOnlyDb', () => {
  const calls: string[] = []
  const client = {
    employerProfile: { findMany: async () => (calls.push('findMany'), []), update: async () => calls.push('update'), create: async () => calls.push('create') },
    $executeRaw: async () => calls.push('raw'),
    $queryRaw: async () => calls.push('rawq'),
    $transaction: async () => calls.push('tx'),
    $disconnect: async () => calls.push('disconnect'),
  }
  const db = readOnlyDb(client)

  it('lets reads through', async () => {
    await db.employerProfile.findMany()
    expect(calls).toContain('findMany')
  })

  it('refuses every write, raw query and transaction before it reaches the client', () => {
    expect(() => db.employerProfile.update()).toThrow(ReadOnlyViolation)
    expect(() => db.employerProfile.create()).toThrow(ReadOnlyViolation)
    expect(() => db.$executeRaw()).toThrow(ReadOnlyViolation)
    expect(() => db.$queryRaw()).toThrow(ReadOnlyViolation)
    expect(() => db.$transaction()).toThrow(ReadOnlyViolation)
    expect(calls).not.toContain('update')
    expect(calls).not.toContain('create')
    expect(calls).not.toContain('raw')
    expect(calls).not.toContain('tx')
  })

  it('still lets the script disconnect', async () => {
    await db.$disconnect()
    expect(calls).toContain('disconnect')
  })
})
