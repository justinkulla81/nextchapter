import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  employerProfile: { findUnique: vi.fn() },
  employerSeat: { findFirst: vi.fn(), count: vi.fn() },
  outplacementOrgUser: { findUnique: vi.fn(), count: vi.fn() },
  outplacementContract: { findMany: vi.fn() },
  outplacementEmployerOrg: { findUnique: vi.fn() },
  orgWorkspaceAdmin: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn(), delete: vi.fn(), update: vi.fn() },
}))
const auth = vi.hoisted(() => ({ user: { id: 'u1', email: 'pat@acme.com' } as { id: string; email: string } | null }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: auth.user } }) } }) }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`)
  },
}))
const capture = vi.hoisted(() => vi.fn())
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: capture }))

import { SECTION_ROLES, firstAllowed, isSectionRole, lastAdminBlock } from '@/lib/employer/section-roles'
import { deniedRedirect, requireSectionRole, requireSectionRoleForAction, resolveSectionMember } from '@/lib/employer/section-auth'
import { getCurrentEmployerPortalMember, getCurrentOutplacementOrgUser, requireEmployeesRole, requireEmployeesRoleForAction, requireOutplacementRole, requireOutplacementRoleForAction } from '@/lib/employer/outplacement-auth'
import { removeWorkspaceAdmin, setWorkspaceAdminRole } from '@/lib/employer/workspace-admins'

const wsRow = (type: string, role: string, refId: string | null = 'org1') => ({ role, workspace: { id: 'w1', orgId: 'O1', type, refId, plan: 'FREE', services: {}, org: { enterprise: false } } })

beforeEach(() => {
  vi.clearAllMocks()
  auth.user = { id: 'u1', email: 'pat@acme.com' }
  db.employerProfile.findUnique.mockResolvedValue(null)
  db.employerSeat.findFirst.mockResolvedValue(null)
  db.outplacementOrgUser.findUnique.mockResolvedValue(null)
  db.outplacementContract.findMany.mockResolvedValue([])
  db.outplacementEmployerOrg.findUnique.mockResolvedValue({ id: 'org1', name: 'Acme', programBrandName: null })
  db.orgWorkspaceAdmin.findMany.mockResolvedValue([])
})

describe('roles per section', () => {
  it('Hiring and Employees have ADMIN, VIEWER, BILLING; Outplacement keeps its four', () => {
    expect(SECTION_ROLES.hiring).toEqual(['ADMIN', 'VIEWER', 'BILLING'])
    expect(SECTION_ROLES.employees).toEqual(['ADMIN', 'VIEWER', 'BILLING'])
    expect(SECTION_ROLES.outplacement).toEqual(['ADMIN', 'VIEWER', 'LEGAL', 'FINANCE'])
    expect(isSectionRole('outplacement', 'LEGAL')).toBe(true)
    expect(isSectionRole('hiring', 'LEGAL')).toBe(false)
    expect(isSectionRole('employees', 'FINANCE')).toBe(false)
  })
  it('picks the first allowed grant, so a legacy grant wins', () => {
    expect(firstAllowed([{ role: 'VIEWER', n: 1 }, { role: 'ADMIN', n: 2 }], ['ADMIN', 'VIEWER'])?.n).toBe(1)
    expect(firstAllowed([{ role: 'VIEWER' }], ['ADMIN'])).toBeNull()
  })
})

describe('the last-admin rule every section shares', () => {
  const admin = { userId: 'a', role: 'ADMIN', active: true }
  it('never yourself', () => {
    expect(lastAdminBlock('a', admin, 3)).toMatch(/remove yourself/)
  })
  it('never the last active admin, by removal or by taking the role away', () => {
    expect(lastAdminBlock('b', admin, 1)).toMatch(/only active admin/)
    expect(lastAdminBlock('b', admin, 1, 'change_role')).toMatch(/only active admin/)
  })
  it('allows removing an admin when another remains, a viewer, and a pending invite', () => {
    expect(lastAdminBlock('b', admin, 2)).toBeNull()
    expect(lastAdminBlock('b', { userId: 'v', role: 'VIEWER', active: true }, 1)).toBeNull()
    expect(lastAdminBlock('b', { userId: null, role: 'ADMIN', active: false }, 1)).toBeNull()
  })
})

describe('resolveSectionMember: legacy first, the new table only as a fallback', () => {
  it('answers from the legacy rows without reading the new table when they allow the role', async () => {
    db.outplacementOrgUser.findUnique.mockResolvedValue({ role: 'ADMIN', orgId: 'org1' })
    const r = await resolveSectionMember('outplacement', ['ADMIN'], { userId: 'u1', email: null })
    expect(r).toMatchObject({ ok: true, member: { role: 'ADMIN', source: 'outplacement_org_user', recordId: 'org1' } })
    expect(db.orgWorkspaceAdmin.findMany).not.toHaveBeenCalled()
  })

  it('a hiring owner is an ADMIN and a MEMBER seat is a VIEWER', async () => {
    db.employerProfile.findUnique.mockResolvedValue({ id: 'p1' })
    expect(await resolveSectionMember('hiring', ['ADMIN'], { userId: 'u1', email: null })).toMatchObject({ ok: true, member: { role: 'ADMIN', source: 'hiring_owner' } })
    db.employerProfile.findUnique.mockResolvedValue(null)
    db.employerSeat.findFirst.mockResolvedValue({ role: 'MEMBER', employerId: 'p1' })
    expect(await resolveSectionMember('hiring', ['ADMIN'], { userId: 'u1', email: null })).toEqual({ ok: false, reason: 'wrong_role' })
    expect(await resolveSectionMember('hiring', ['ADMIN', 'VIEWER'], { userId: 'u1', email: null })).toMatchObject({ ok: true, member: { role: 'VIEWER' } })
  })

  it('falls back to the new table when there is no legacy row', async () => {
    db.orgWorkspaceAdmin.findMany.mockResolvedValue([wsRow('HIRING', 'BILLING', 'p9')])
    const r = await resolveSectionMember('hiring', ['BILLING'], { userId: 'u1', email: 'pat@acme.com' })
    expect(r).toMatchObject({ ok: true, member: { role: 'BILLING', source: 'workspace_admin', workspaceId: 'w1' } })
  })

  it('the new table can add a role the legacy rows lack, but never takes one away', async () => {
    db.outplacementOrgUser.findUnique.mockResolvedValue({ role: 'VIEWER', orgId: 'org1' })
    db.orgWorkspaceAdmin.findMany.mockResolvedValue([wsRow('OUTPLACEMENT', 'ADMIN')])
    expect(await resolveSectionMember('outplacement', ['ADMIN'], { userId: 'u1', email: null })).toMatchObject({ ok: true, member: { role: 'ADMIN', source: 'workspace_admin' } })
    // an empty new table changes nothing for the legacy VIEWER
    db.orgWorkspaceAdmin.findMany.mockResolvedValue([])
    expect(await resolveSectionMember('outplacement', ['VIEWER'], { userId: 'u1', email: null })).toMatchObject({ ok: true, member: { role: 'VIEWER' } })
  })

  it('still answers from the legacy rows when the new table cannot be read', async () => {
    db.outplacementOrgUser.findUnique.mockResolvedValue({ role: 'LEGAL', orgId: 'org1' })
    db.orgWorkspaceAdmin.findMany.mockRejectedValue(new Error('relation "OrgWorkspaceAdmin" does not exist'))
    expect(await resolveSectionMember('outplacement', ['LEGAL'], { userId: 'u1', email: null })).toMatchObject({ ok: true })
    expect(await resolveSectionMember('outplacement', ['ADMIN'], { userId: 'u1', email: null })).toEqual({ ok: false, reason: 'wrong_role' })
  })

  it('tells apart: another section held, nothing held', async () => {
    db.employerProfile.findUnique.mockResolvedValue({ id: 'p1' })
    expect(await resolveSectionMember('outplacement', ['ADMIN'], { userId: 'u1', email: null })).toEqual({ ok: false, reason: 'other_sections' })
    db.employerProfile.findUnique.mockResolvedValue(null)
    expect(await resolveSectionMember('outplacement', ['ADMIN'], { userId: 'u1', email: null })).toEqual({ ok: false, reason: 'holds_nothing' })
  })

  it('sends a person who holds another section to the chooser and keeps the explainer for people who hold nothing', () => {
    expect(deniedRedirect('outplacement', 'other_sections')).toBe('/employer-home')
    expect(deniedRedirect('outplacement', 'holds_nothing')).toBe('/employer/signup')
    expect(deniedRedirect('hiring', 'signed_out')).toBe('/talent/login')
    expect(deniedRedirect('employees', 'signed_out')).toBe('/employer/login')
    expect(deniedRedirect('outplacement', 'wrong_role')).toBe('/employer')
  })

  it('requireSectionRole redirects when signed out and returns null for actions', async () => {
    auth.user = null
    await expect(requireSectionRole('hiring', ['ADMIN'])).rejects.toThrow('REDIRECT:/talent/login')
    expect(await requireSectionRoleForAction('hiring', ['ADMIN'])).toBeNull()
  })
})

describe('the outplacement resolvers keep today\'s behavior and add the fallback', () => {
  it('a person with a legacy row gets exactly the legacy result, and the new table is not asked', async () => {
    db.outplacementOrgUser.findUnique.mockResolvedValue({ id: 'ou1', role: 'ADMIN', fullName: 'Pat', org: { id: 'org1', name: 'Acme', programBrandName: 'AcmeCo' } })
    expect(await getCurrentOutplacementOrgUser()).toEqual({ id: 'ou1', userId: 'u1', email: 'pat@acme.com', role: 'ADMIN', fullName: 'Pat', orgId: 'org1', orgName: 'Acme', programBrandName: 'AcmeCo' })
    expect(await requireOutplacementRole(['ADMIN'])).toMatchObject({ role: 'ADMIN' })
    await expect(requireOutplacementRole(['LEGAL'])).rejects.toThrow('REDIRECT:/employer')
    expect(await requireOutplacementRoleForAction(['LEGAL'])).toBeNull()
    expect(db.orgWorkspaceAdmin.findMany).not.toHaveBeenCalled()
  })

  it('signed out goes to the login, as before', async () => {
    auth.user = null
    await expect(getCurrentOutplacementOrgUser()).rejects.toThrow('REDIRECT:/employer/login')
    expect(await requireOutplacementRoleForAction(['ADMIN'])).toBeNull()
  })

  it('with no legacy row, an ACTIVE outplacement workspace admin linked to an org gets in', async () => {
    db.orgWorkspaceAdmin.findMany.mockResolvedValue([wsRow('OUTPLACEMENT', 'FINANCE', 'org1')])
    expect(await getCurrentOutplacementOrgUser()).toMatchObject({ role: 'FINANCE', orgId: 'org1', orgName: 'Acme' })
    expect(await requireOutplacementRoleForAction(['FINANCE'])).toMatchObject({ role: 'FINANCE' })
    expect(await requireOutplacementRoleForAction(['ADMIN'])).toBeNull()
  })

  it('an Employees workspace admin does not get the outplacement pages', async () => {
    db.orgWorkspaceAdmin.findMany.mockResolvedValue([wsRow('EMPLOYEES', 'ADMIN', 'org1')])
    await expect(getCurrentOutplacementOrgUser()).rejects.toThrow('REDIRECT:/employer-home')
    expect(await requireOutplacementRoleForAction(['ADMIN'])).toBeNull()
  })

  it('a workspace not linked to an org yet gives nothing', async () => {
    db.orgWorkspaceAdmin.findMany.mockResolvedValue([wsRow('OUTPLACEMENT', 'ADMIN', null)])
    await expect(getCurrentOutplacementOrgUser()).rejects.toThrow('REDIRECT:/employer-home')
  })

  it('with nothing at all, the explainer stays; holding only Hiring goes to the chooser', async () => {
    await expect(getCurrentOutplacementOrgUser()).rejects.toThrow('REDIRECT:/employer/signup')
    db.employerProfile.findUnique.mockResolvedValue({ id: 'p1' })
    await expect(getCurrentOutplacementOrgUser()).rejects.toThrow('REDIRECT:/employer-home')
  })

  it('a failing new table leaves today\'s explainer in place', async () => {
    db.orgWorkspaceAdmin.findMany.mockRejectedValue(new Error('no table'))
    await expect(getCurrentOutplacementOrgUser()).rejects.toThrow('REDIRECT:/employer/signup')
  })
})

describe('Employees (Growth and Learning)', () => {
  it('a legacy ADMIN or VIEWER row works exactly as today', async () => {
    db.outplacementOrgUser.findUnique.mockResolvedValue({ id: 'ou1', role: 'VIEWER', fullName: null, org: { id: 'org1', name: 'Acme', programBrandName: null } })
    expect(await requireEmployeesRole(['ADMIN', 'VIEWER'])).toMatchObject({ role: 'VIEWER' })
    await expect(requireEmployeesRole(['ADMIN'])).rejects.toThrow('REDIRECT:/employer')
    expect(await requireEmployeesRoleForAction(['ADMIN'])).toBeNull()
  })

  it('an Employees workspace ADMIN or VIEWER gets in without a legacy row; BILLING does not', async () => {
    db.orgWorkspaceAdmin.findMany.mockResolvedValue([wsRow('EMPLOYEES', 'VIEWER', 'org1')])
    expect(await requireEmployeesRole(['ADMIN', 'VIEWER'])).toMatchObject({ role: 'VIEWER', orgId: 'org1' })
    db.orgWorkspaceAdmin.findMany.mockResolvedValue([wsRow('EMPLOYEES', 'BILLING', 'org1')])
    await expect(requireEmployeesRole(['ADMIN', 'VIEWER'])).rejects.toThrow('REDIRECT:/employer-home')
  })

  it('the layout resolver shows an Employees-only person the Employees pages only', async () => {
    db.orgWorkspaceAdmin.findMany.mockResolvedValue([wsRow('EMPLOYEES', 'ADMIN', 'org1')])
    expect(await getCurrentEmployerPortalMember()).toMatchObject({ employeesOnly: true, role: 'ADMIN' })
    db.outplacementOrgUser.findUnique.mockResolvedValue({ id: 'ou1', role: 'ADMIN', fullName: null, org: { id: 'org1', name: 'Acme', programBrandName: null } })
    expect(await getCurrentEmployerPortalMember()).toMatchObject({ employeesOnly: false })
  })
})

describe('last-admin protection in the workspace admin library', () => {
  const target = (over = {}) => ({ id: 'a2', workspaceId: 'w1', role: 'ADMIN', userId: 'u2', email: 'two@acme.com', workspace: { type: 'EMPLOYEES' }, ...over })
  beforeEach(() => {
    db.orgWorkspaceAdmin.findUnique.mockResolvedValue(target())
    db.orgWorkspaceAdmin.findFirst.mockResolvedValue({ id: 'a1' })
    db.orgWorkspaceAdmin.count.mockResolvedValue(2)
    db.orgWorkspaceAdmin.delete.mockResolvedValue({})
    db.orgWorkspaceAdmin.update.mockResolvedValue({})
  })
  const actor = { userId: 'u1', email: 'pat@acme.com' }

  it('removes an admin when another remains', async () => {
    expect(await removeWorkspaceAdmin(actor, 'a2')).toEqual({})
    expect(db.orgWorkspaceAdmin.delete).toHaveBeenCalledOnce()
    expect(capture).toHaveBeenCalledWith('u1', 'employer_section_admin_removed', expect.objectContaining({ section: 'employees', role: 'ADMIN' }))
  })
  it('refuses the last active admin, and yourself', async () => {
    db.orgWorkspaceAdmin.count.mockResolvedValue(1)
    expect(await removeWorkspaceAdmin(actor, 'a2')).toEqual({ error: expect.stringContaining('only active admin') })
    db.orgWorkspaceAdmin.count.mockResolvedValue(3)
    db.orgWorkspaceAdmin.findUnique.mockResolvedValue(target({ userId: 'u1' }))
    expect(await removeWorkspaceAdmin(actor, 'a2')).toEqual({ error: expect.stringContaining('remove yourself') })
    expect(db.orgWorkspaceAdmin.delete).not.toHaveBeenCalled()
  })
  it('only an admin of the same section may change it', async () => {
    db.orgWorkspaceAdmin.findFirst.mockResolvedValue(null)
    expect(await removeWorkspaceAdmin(actor, 'a2')).toEqual({ error: expect.stringContaining('Only an admin') })
    expect(await setWorkspaceAdminRole(actor, 'a2', 'VIEWER')).toEqual({ error: expect.stringContaining('Only an admin') })
    expect(db.orgWorkspaceAdmin.delete).not.toHaveBeenCalled()
    expect(db.orgWorkspaceAdmin.update).not.toHaveBeenCalled()
  })
  it('takes ADMIN away only when another admin remains, and only to a role the section has', async () => {
    db.orgWorkspaceAdmin.count.mockResolvedValue(1)
    expect(await setWorkspaceAdminRole(actor, 'a2', 'VIEWER')).toEqual({ error: expect.stringContaining('only active admin') })
    db.orgWorkspaceAdmin.count.mockResolvedValue(2)
    expect(await setWorkspaceAdminRole(actor, 'a2', 'VIEWER')).toEqual({})
    expect(db.orgWorkspaceAdmin.update).toHaveBeenCalledWith({ where: { id: 'a2' }, data: { role: 'VIEWER' } })
    expect(await setWorkspaceAdminRole(actor, 'a2', 'LEGAL')).toEqual({ error: expect.stringContaining('does not exist') })
  })
})
