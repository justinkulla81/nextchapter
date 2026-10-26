import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { planAdmins, planWorkspaces, servicesFromContracts, type ContractRow, type OutOrgRow, type WorkspaceRow } from '../../scripts/employer/backfill-lib'
import { runAdminBackfill, runWorkspaceBackfill } from '../../scripts/employer/backfill-run'
import { readOnlyDb, ReadOnlyViolation } from '../../scripts/employer/read-only-db'
import { companyKey, contractsTable, overlapByEmailOnly, overlapByUser, pendingOrgUsers, severalHiringAccounts } from '../../scripts/employer/audit-lib'

const org = (id: string, over: Partial<OutOrgRow> = {}): OutOrgRow => ({ id, name: `Org ${id}`, primaryContactEmail: `hr@${id}.com`, isSampleData: false, ...over })
const ws = (over: Partial<WorkspaceRow> & { id: string; type: string }): WorkspaceRow => ({ orgId: 'O1', refId: null, status: 'ACTIVE', plan: 'FREE', planSource: null, services: {}, ...over })
const contract = (orgId: string, programType: ContractRow['programType'], status: ContractRow['status'] = 'ACTIVE'): ContractRow => ({ orgId, programType, status })
const NOW = new Date('2026-10-25T00:00:00Z')

describe('workspace backfill plan', () => {
  it('sets services from active contracts: GROWTH is retention, LEARNING is learning, retraining stays off', () => {
    expect(servicesFromContracts([contract('a', 'GROWTH')])).toEqual({ learning: false, retention: true, retraining: false })
    expect(servicesFromContracts([contract('a', 'LEARNING'), contract('a', 'GROWTH', 'EXPIRED')])).toEqual({ learning: true, retention: false, retraining: false })
  })

  it('creates the Employees workspace for an org with a GROWTH or LEARNING contract, pointing at the same record', () => {
    const p = planWorkspaces({ orgs: [org('a')], contracts: [contract('a', 'OUTPLACEMENT'), contract('a', 'GROWTH')], workspaces: [ws({ id: 'w1', type: 'OUTPLACEMENT', refId: 'a' })], now: NOW })
    expect(p.ops).toEqual([
      { kind: 'update_workspace', workspaceId: 'w1', why: expect.any(String), data: { plan: 'CONTRACT', planSource: 'CONTRACT', planUpdatedAt: NOW } },
      { kind: 'create_workspace', organizationId: 'O1', why: expect.any(String), data: { type: 'EMPLOYEES', refId: 'a', status: 'ACTIVE', plan: 'CONTRACT', planSource: 'CONTRACT', planUpdatedAt: NOW, services: { learning: false, retention: true, retraining: false } } },
    ])
  })

  it('creates nothing for Employees when there is no active GROWTH or LEARNING contract, and never touches GROWTH or LEARNING contracts', () => {
    const p = planWorkspaces({ orgs: [org('a')], contracts: [contract('a', 'GROWTH', 'EXPIRED')], workspaces: [ws({ id: 'w1', type: 'OUTPLACEMENT', refId: 'a' })], now: NOW })
    expect(p.ops).toEqual([])
  })

  it('is idempotent: a second run over the result plans nothing', () => {
    const first = planWorkspaces({ orgs: [org('a')], contracts: [contract('a', 'OUTPLACEMENT'), contract('a', 'LEARNING')], workspaces: [ws({ id: 'w1', type: 'OUTPLACEMENT', refId: 'a' })], now: NOW })
    const after: WorkspaceRow[] = [
      ws({ id: 'w1', type: 'OUTPLACEMENT', refId: 'a', plan: 'CONTRACT', planSource: 'CONTRACT' }),
      ws({ id: 'w2', type: 'EMPLOYEES', refId: 'a', plan: 'CONTRACT', planSource: 'CONTRACT', services: { learning: true, retention: false, retraining: false } }),
    ]
    expect(first.ops.length).toBe(2)
    expect(planWorkspaces({ orgs: [org('a')], contracts: [contract('a', 'OUTPLACEMENT'), contract('a', 'LEARNING')], workspaces: after, now: NOW }).ops).toEqual([])
  })

  it('never overwrites a plan someone set or a service staff turned off', () => {
    const p = planWorkspaces({
      orgs: [org('a')],
      contracts: [contract('a', 'OUTPLACEMENT'), contract('a', 'GROWTH'), contract('a', 'LEARNING')],
      workspaces: [
        ws({ id: 'w1', type: 'OUTPLACEMENT', refId: 'a', plan: 'PAID', planSource: 'STAFF' }),
        ws({ id: 'w2', type: 'EMPLOYEES', refId: 'a', plan: 'PAID', planSource: 'STAFF', services: { learning: false } }),
      ],
      now: NOW,
    })
    expect(p.ops).toEqual([{ kind: 'update_workspace', workspaceId: 'w2', why: expect.any(String), data: { services: { learning: false, retention: true, retraining: false } } }])
  })

  it('fills the link on an existing Employees workspace but leaves a workspace pointing elsewhere for a person', () => {
    const base = { orgs: [org('a')], contracts: [contract('a', 'LEARNING')], now: NOW }
    const linked = planWorkspaces({ ...base, workspaces: [ws({ id: 'w1', type: 'OUTPLACEMENT', refId: 'a' }), ws({ id: 'w2', type: 'EMPLOYEES', refId: null, plan: 'PAID', planSource: 'STAFF', services: { learning: true, retention: false, retraining: false } })] })
    expect(linked.ops).toEqual([{ kind: 'update_workspace', workspaceId: 'w2', why: expect.any(String), data: { refId: 'a' } }])
    const conflict = planWorkspaces({ ...base, workspaces: [ws({ id: 'w1', type: 'OUTPLACEMENT', refId: 'a' }), ws({ id: 'w2', type: 'EMPLOYEES', refId: 'other' })] })
    expect(conflict.ops).toEqual([])
    expect(conflict.conflicts).toHaveLength(1)
  })

  it('lists orgs with no Organization instead of creating one, and skips sample data', () => {
    const p = planWorkspaces({ orgs: [org('a'), org('b', { isSampleData: true })], contracts: [], workspaces: [], now: NOW })
    expect(p.withoutOrganization.map((o) => o.id)).toEqual(['a'])
    expect(p.skippedSampleOrgs).toBe(1)
    expect(p.ops).toEqual([])
  })
})

describe('admin backfill plan', () => {
  const workspaces = [ws({ id: 'o', type: 'OUTPLACEMENT', refId: 'a' }), ws({ id: 'e', type: 'EMPLOYEES', refId: 'a' }), ws({ id: 'h', type: 'HIRING', refId: 'p1' })]
  const u = (role: 'ADMIN' | 'VIEWER' | 'LEGAL' | 'FINANCE', email: string) => ({ orgId: 'a', role, invitedEmail: email, userId: `u-${email}`, acceptedAt: NOW })

  it('keeps the four outplacement roles and gives Employees only ADMIN and VIEWER', () => {
    const p = planAdmins({ orgUsers: [u('ADMIN', 'A@x.com'), u('LEGAL', 'l@x.com'), u('FINANCE', 'f@x.com'), u('VIEWER', 'v@x.com')], hiring: [], workspaces, existing: [] })
    const out = p.ops.filter((o) => o.workspaceId === 'o').map((o) => [o.email, o.role])
    expect(out).toEqual([['a@x.com', 'ADMIN'], ['l@x.com', 'LEGAL'], ['f@x.com', 'FINANCE'], ['v@x.com', 'VIEWER']])
    expect(p.ops.filter((o) => o.workspaceId === 'e').map((o) => [o.email, o.role])).toEqual([['a@x.com', 'ADMIN'], ['v@x.com', 'VIEWER']])
    expect(p.ops.every((o) => o.source === 'MIGRATED')).toBe(true)
  })

  it('maps the hiring owner to ADMIN and seats OWNER to ADMIN and MEMBER to VIEWER, and skips what it cannot place', () => {
    const p = planAdmins({
      orgUsers: [],
      hiring: [
        { profileId: 'p1', kind: 'owner', email: 'Boss@x.com', userId: 'ub', role: 'ADMIN', acceptedAt: NOW },
        { profileId: 'p1', kind: 'seat', email: 'm@x.com', userId: null, role: 'VIEWER', acceptedAt: null },
        { profileId: 'p2', kind: 'owner', email: 'z@x.com', userId: 'uz', role: 'ADMIN', acceptedAt: NOW },
        { profileId: 'p1', kind: 'owner', email: null, userId: 'un', role: 'ADMIN', acceptedAt: NOW },
      ],
      workspaces,
      existing: [],
    })
    expect(p.ops.map((o) => [o.email, o.role, o.from])).toEqual([['boss@x.com', 'ADMIN', 'EmployerProfile'], ['m@x.com', 'VIEWER', 'EmployerSeat']])
    expect(p.skipped).toHaveLength(2)
  })

  it('is idempotent: rows that exist are not planned again, whatever the email case', () => {
    const input = { orgUsers: [u('ADMIN', 'a@x.com')], hiring: [], workspaces }
    const first = planAdmins({ ...input, existing: [] })
    const second = planAdmins({ ...input, existing: first.ops.map((o) => ({ workspaceId: o.workspaceId, email: o.email.toUpperCase() })) })
    expect(second.ops).toEqual([])
    expect(second.alreadyThere).toBe(first.ops.length)
  })
})

describe('dry run writes nothing; only --apply reaches the writer', () => {
  function fakeReader() {
    return {
      outplacementEmployerOrg: { findMany: async () => [org('a')] },
      outplacementContract: { findMany: async () => [contract('a', 'OUTPLACEMENT'), contract('a', 'GROWTH')] },
      orgWorkspace: { findMany: async () => [ws({ id: 'w1', type: 'OUTPLACEMENT', refId: 'a' })] },
      orgWorkspaceAdmin: { findMany: async () => [] },
      outplacementOrgUser: { findMany: async () => [{ orgId: 'a', role: 'ADMIN', invitedEmail: 'a@x.com', userId: 'u1', acceptedAt: NOW }] },
      employerProfile: { findMany: async () => [] },
      employerSeat: { findMany: async () => [] },
      organization: { findMany: async () => [], create: vi.fn() },
    }
  }
  const writer = () => ({ orgWorkspace: { create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) }, orgWorkspaceAdmin: { create: vi.fn(async () => ({})) }, organization: { create: vi.fn(async () => ({ id: 'new' })) } })

  it('workspaces: the default run plans but never touches the writer', async () => {
    const w = writer()
    const r = await runWorkspaceBackfill(fakeReader() as never, w as never, { apply: false })
    expect(r.plan.ops.length).toBe(2)
    expect(r.applied).toBeNull()
    expect(w.orgWorkspace.create).not.toHaveBeenCalled()
    expect(w.orgWorkspace.update).not.toHaveBeenCalled()
    expect(w.organization.create).not.toHaveBeenCalled()
  })

  it('workspaces: --apply writes exactly the plan, and a duplicate create counts as already existing', async () => {
    const w = writer()
    w.orgWorkspace.create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
    const r = await runWorkspaceBackfill(fakeReader() as never, w as never, { apply: true })
    expect(r.applied).toEqual({ created: 0, updated: 1, alreadyExisted: 1, organizationsCreated: 0 })
  })

  it('workspaces: an Organization is created only for ids on the reviewed list', async () => {
    const reader = fakeReader()
    reader.orgWorkspace.findMany = async () => []
    const w1 = writer()
    await runWorkspaceBackfill(reader as never, w1 as never, { apply: true })
    expect(w1.organization.create).not.toHaveBeenCalled()
    const w2 = writer()
    const r = await runWorkspaceBackfill(reader as never, w2 as never, { apply: true, createOrganizationsFor: ['a'] })
    expect(r.applied?.organizationsCreated).toBe(1)
    expect(w2.organization.create).toHaveBeenCalledOnce()
  })

  it('admins: the default run never touches the writer', async () => {
    const w = writer()
    const reader = fakeReader()
    reader.orgWorkspace.findMany = async () => [ws({ id: 'o', type: 'OUTPLACEMENT', refId: 'a' })]
    const r = await runAdminBackfill(reader as never, w as never, { apply: false }, async () => null)
    expect(r.plan.ops).toHaveLength(1)
    expect(w.orgWorkspaceAdmin.create).not.toHaveBeenCalled()
    const applied = await runAdminBackfill(reader as never, w as never, { apply: true }, async () => null)
    expect(applied.applied).toEqual({ created: 1, alreadyExisted: 0 })
  })

  it('the read-only wrapper stops a write even if the code tried one', async () => {
    const w = writer()
    const guarded = readOnlyDb({ ...fakeReader(), orgWorkspace: { findMany: async () => [], create: w.orgWorkspace.create } })
    expect(() => guarded.orgWorkspace.create()).toThrow(ReadOnlyViolation)
    expect(w.orgWorkspace.create).not.toHaveBeenCalled()
  })

  it('every script requires --apply to write and reads through the read-only wrapper', () => {
    for (const f of ['scripts/employer/backfill-workspaces.ts', 'scripts/employer/backfill-workspace-admins.ts']) {
      const src = readFileSync(f, 'utf8')
      expect(src).toContain("flag('apply')")
      expect(src).toContain('readOnlyDb(base)')
    }
    for (const f of ['scripts/employer/audit.ts', 'scripts/employer/access-diff.ts']) {
      const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')
      expect(src).toContain('readOnlyDb(base)')
      expect(src).not.toMatch(/\.(create|update|upsert|delete|createMany|updateMany|deleteMany)\(|\$executeRaw|\$queryRaw/)
      expect(src).not.toContain('--apply')
    }
  })
})

describe('audit counting', () => {
  const hiring = [
    { profileId: 'p1', userId: 'u1', companyName: 'Acme Inc.', companyWebsite: 'https://www.acme.com/careers', email: 'a@acme.com' },
    { profileId: 'p2', userId: 'u2', companyName: 'ACME, LLC', companyWebsite: 'acme.com', email: 'b@acme.com' },
    { profileId: 'p3', userId: 'u3', companyName: 'Solo Co', companyWebsite: null, email: 'c@solo.com' },
  ]
  const orgUsers = [
    { orgId: 'o1', userId: 'u1', invitedEmail: 'a@acme.com', acceptedAt: NOW, invitedAt: NOW },
    { orgId: 'o2', userId: 'uX', invitedEmail: 'C@solo.com', acceptedAt: null, invitedAt: new Date('2026-01-01') },
    { orgId: 'o3', userId: null, invitedEmail: 'zz@z.com', acceptedAt: null, invitedAt: NOW },
  ]
  it('finds people with both accounts under one sign-in, and by email under two', () => {
    expect(overlapByUser(['u1', 'u2'], orgUsers)).toEqual(['u1'])
    expect(overlapByEmailOnly(hiring, orgUsers)).toEqual([{ hiringUserId: 'u3', orgId: 'o2' }])
  })
  it('groups hiring accounts by website host, else name', () => {
    expect(companyKey(hiring[0])).toBe('site:acme.com')
    expect(severalHiringAccounts(hiring)).toEqual([{ key: 'site:acme.com', accounts: 2, example: 'Acme Inc.' }])
    expect(companyKey({ companyName: 'Foo & Bar, Inc', companyWebsite: null })).toBe('name:foo and bar')
  })
  it('counts pending outplacement logins and contracts', () => {
    expect(pendingOrgUsers(orgUsers, NOW)).toEqual({ total: 2, olderThan30Days: 1 })
    expect(contractsTable([{ programType: 'LEARNING', status: 'ACTIVE', _count: { _all: 2 } }, { programType: 'GROWTH', status: 'ACTIVE', _count: { _all: 1 } }])).toEqual([
      { programType: 'GROWTH', status: 'ACTIVE', contracts: 1 },
      { programType: 'LEARNING', status: 'ACTIVE', contracts: 2 },
    ])
  })
})
