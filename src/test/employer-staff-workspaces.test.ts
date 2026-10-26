import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const db = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  orgWorkspace: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  orgWorkspaceAdmin: { findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  orgClaim: { findUnique: vi.fn(), findMany: vi.fn() },
  outplacementEmployerOrg: { findUnique: vi.fn(), findMany: vi.fn() },
  employerProfile: { findMany: vi.fn() },
  partnerAuditEvent: { create: vi.fn() },
}))
const auth = vi.hoisted(() => ({ requireAdmin: vi.fn() }))
const capture = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/admin/auth', () => ({ requireAdmin: auth.requireAdmin }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: capture }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  activateBlockedReason,
  addWorkspaceAdmin,
  linkWorkspaceRecord,
  loadStaffSectionViews,
  makeAdminFromRequest,
  searchLinkableRecords,
  setWorkspaceStatus,
} from '@/lib/employer/staff-workspaces'
import { removeWorkspaceAdmin, setWorkspaceAdminRole } from '@/lib/employer/workspace-admins'
import * as actions from '@/app/support/admin/(portal)/organizations/workspace-actions'

const STAFF = { id: 'staff1', email: 'staff@nextchapter.test' }
const staff = { userId: STAFF.id, email: STAFF.email, staff: true as const }

beforeEach(() => {
  vi.clearAllMocks()
  auth.requireAdmin.mockResolvedValue(STAFF)
  db.orgWorkspace.updateMany.mockResolvedValue({ count: 1 })
  db.orgWorkspace.update.mockResolvedValue({})
  db.orgWorkspaceAdmin.create.mockResolvedValue({ id: 'a-new' })
  db.orgWorkspaceAdmin.update.mockResolvedValue({})
  db.orgWorkspaceAdmin.delete.mockResolvedValue({})
  db.partnerAuditEvent.create.mockResolvedValue({})
})

const ws = (over = {}) => ({ id: 'w1', orgId: 'o1', type: 'OUTPLACEMENT', status: 'PENDING', refId: null, inviteEmail: null, _count: { admins: 2 }, ...over })

describe('every staff action asks for staff first', () => {
  const names = ['setSectionStatusAction', 'searchLinkableRecordsAction', 'linkSectionRecordAction', 'addSectionAdminAction', 'makeAdminFromRequestAction', 'setSectionAdminRoleAction', 'removeSectionAdminAction'] as const
  it('refuses when requireAdmin refuses, and touches nothing', async () => {
    auth.requireAdmin.mockRejectedValue(new Error('REDIRECT:/support/admin/login'))
    const calls: Array<() => Promise<unknown>> = [
      () => actions.setSectionStatusAction('w1', 'ACTIVE'),
      () => actions.searchLinkableRecordsAction('w1', 'acme'),
      () => actions.linkSectionRecordAction('w1', 'r1'),
      () => actions.addSectionAdminAction('w1', 'a@b.com', 'ADMIN'),
      () => actions.makeAdminFromRequestAction('c1'),
      () => actions.setSectionAdminRoleAction('a1', 'VIEWER'),
      () => actions.removeSectionAdminAction('a1'),
    ]
    for (const call of calls) await expect(call()).rejects.toThrow(/REDIRECT/)
    for (const model of Object.values(db)) for (const fn of Object.values(model)) expect(fn).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
  })
  it('calls requireAdmin as the first statement of each exported action', () => {
    const src = readFileSync('src/app/support/admin/(portal)/organizations/workspace-actions.ts', 'utf8')
    for (const n of names) {
      const body = src.slice(src.indexOf(`export async function ${n}`))
      expect(body.slice(0, 260)).toMatch(/const admin = await requireAdmin\(\)|await requireAdmin\(\)/)
    }
    expect(src.startsWith("'use server'")).toBe(true)
  })
})

describe('activation', () => {
  it('activates a pending section, guarded against a concurrent change, with an event of ids and an audit entry', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(ws())
    const r = await actions.setSectionStatusAction('w1', 'ACTIVE')
    expect(r.error).toBeUndefined()
    expect(r.message).toMatch(/admins can now sign in/)
    expect(db.orgWorkspace.updateMany).toHaveBeenCalledWith({ where: { id: 'w1', status: 'PENDING' }, data: { status: 'ACTIVE' } })
    expect(capture).toHaveBeenCalledWith(STAFF.id, 'employer_workspace_activated', { organizationId: 'o1', workspaceId: 'w1', section: 'outplacement', from: 'PENDING', adminCount: 2 })
    // Not linked yet, so the audit entry is kept under the workspace's own id.
    expect(db.partnerAuditEvent.create.mock.calls[0][0].data).toMatchObject({ portal: 'OUTPLACEMENT', refId: 'w1', action: 'workspace.activated', actorUserId: STAFF.id })
  })
  it('files the audit entry under the portal record once the section is linked', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(ws({ refId: 'op9' }))
    await actions.setSectionStatusAction('w1', 'ACTIVE')
    expect(db.partnerAuditEvent.create.mock.calls[0][0].data.refId).toBe('op9')
  })
  it('suspends an active section and says what it does', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(ws({ status: 'ACTIVE' }))
    const r = await actions.setSectionStatusAction('w1', 'SUSPENDED')
    expect(r.message).toMatch(/no longer sign in/)
    expect(capture).toHaveBeenCalledWith(STAFF.id, 'employer_workspace_suspended', expect.objectContaining({ from: 'ACTIVE', section: 'outplacement' }))
  })
  it('reactivates a suspended section with the activated event', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(ws({ status: 'SUSPENDED' }))
    await actions.setSectionStatusAction('w1', 'ACTIVE')
    expect(capture).toHaveBeenCalledWith(STAFF.id, 'employer_workspace_activated', expect.objectContaining({ from: 'SUSPENDED' }))
  })
  it('does nothing and sends no event when it is already in that state', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(ws({ status: 'ACTIVE' }))
    const r = await actions.setSectionStatusAction('w1', 'ACTIVE')
    expect(r.message).toMatch(/already active/)
    expect(db.orgWorkspace.updateMany).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
    expect(db.partnerAuditEvent.create).not.toHaveBeenCalled()
  })
  it('refuses to activate Hiring by hand while its claimant has not signed up, because sign-up activates it', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(ws({ type: 'HIRING', inviteEmail: 'pat@acme.com' }))
    const r = await setWorkspaceStatus({ workspaceId: 'w1', to: 'ACTIVE' }, db as never)
    expect(r.error).toMatch(/goes live on its own when pat@acme.com signs up/)
    expect(db.orgWorkspace.updateMany).not.toHaveBeenCalled()
    expect(activateBlockedReason({ type: 'HIRING', status: 'PENDING', refId: 'e1', inviteEmail: 'pat@acme.com' })).toBeNull()
    expect(activateBlockedReason({ type: 'HIRING', status: 'PENDING', refId: null, inviteEmail: null })).toBeNull()
  })
  it('refuses a status that is not Activate or Suspend, an unknown section, a non-employer workspace and a stale click', async () => {
    expect((await setWorkspaceStatus({ workspaceId: 'w1', to: 'PENDING' }, db as never)).error).toBeDefined()
    db.orgWorkspace.findUnique.mockResolvedValue(null)
    expect((await setWorkspaceStatus({ workspaceId: 'w1', to: 'ACTIVE' }, db as never)).error).toMatch(/no longer exists/)
    db.orgWorkspace.findUnique.mockResolvedValue(ws({ type: 'COACH' }))
    expect((await setWorkspaceStatus({ workspaceId: 'w1', to: 'ACTIVE' }, db as never)).error).toMatch(/Hiring, Employees and Outplacement/)
    db.orgWorkspace.findUnique.mockResolvedValue(ws())
    expect((await setWorkspaceStatus({ workspaceId: 'w1', to: 'SUSPENDED' }, db as never)).error).toMatch(/nothing to suspend/)
    db.orgWorkspace.updateMany.mockResolvedValue({ count: 0 })
    expect((await setWorkspaceStatus({ workspaceId: 'w1', to: 'ACTIVE' }, db as never)).error).toMatch(/Someone else/)
  })
  it('turns a thrown database error into a plain message', async () => {
    db.orgWorkspace.findUnique.mockRejectedValue(new Error('connection reset'))
    const r = await actions.setSectionStatusAction('w1', 'ACTIVE')
    expect(r.error).toMatch(/Reload the page/)
    expect(r.error).not.toMatch(/connection reset/)
  })
})

describe('linking an existing employer record', () => {
  it('points the section at the record and writes nothing else', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue({ id: 'w1', orgId: 'o1', type: 'EMPLOYEES', refId: null })
    db.outplacementEmployerOrg.findUnique.mockResolvedValue({ id: 'op1', name: 'Acme Corp' })
    db.orgWorkspace.findFirst.mockResolvedValue(null)
    const r = await actions.linkSectionRecordAction('w1', 'op1')
    expect(r.message).toMatch(/linked to Acme Corp/)
    expect(db.orgWorkspace.update).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { refId: 'op1' } })
    expect(capture).toHaveBeenCalledWith(STAFF.id, 'employer_workspace_linked', { organizationId: 'o1', workspaceId: 'w1', section: 'employees', refId: 'op1' })
    expect(db.partnerAuditEvent.create.mock.calls[0][0].data).toMatchObject({ action: 'workspace.linked', refId: 'op1' })
    for (const m of ['create', 'delete']) expect((db.outplacementEmployerOrg as Record<string, unknown>)[m]).toBeUndefined()
  })
  it('refuses a record that another organization’s section already uses', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue({ id: 'w1', orgId: 'o1', type: 'OUTPLACEMENT', refId: null })
    db.outplacementEmployerOrg.findUnique.mockResolvedValue({ id: 'op1', name: 'Acme Corp' })
    db.orgWorkspace.findFirst.mockResolvedValue({ id: 'other' })
    const r = await linkWorkspaceRecord({ workspaceId: 'w1', recordId: 'op1' }, db as never)
    expect(r.error).toMatch(/already linked to another organization/)
    expect(db.orgWorkspace.update).not.toHaveBeenCalled()
  })
  it('refuses a missing record, and Hiring, which links itself at sign-up', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue({ id: 'w1', orgId: 'o1', type: 'OUTPLACEMENT', refId: null })
    db.outplacementEmployerOrg.findUnique.mockResolvedValue(null)
    expect((await linkWorkspaceRecord({ workspaceId: 'w1', recordId: 'nope' }, db as never)).error).toMatch(/no longer exists/)
    db.orgWorkspace.findUnique.mockResolvedValue({ id: 'w1', orgId: 'o1', type: 'HIRING', refId: null })
    expect((await linkWorkspaceRecord({ workspaceId: 'w1', recordId: 'op1' }, db as never)).error).toMatch(/Hiring links itself/)
    expect(db.orgWorkspace.update).not.toHaveBeenCalled()
  })
  it('removes a link on request and records it as unlinked, under the record it pointed at', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue({ id: 'w1', orgId: 'o1', type: 'OUTPLACEMENT', refId: 'op1' })
    const r = await actions.linkSectionRecordAction('w1', null)
    expect(r.message).toMatch(/no longer linked/)
    expect(db.orgWorkspace.update).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { refId: null } })
    expect(capture).toHaveBeenCalledWith(STAFF.id, 'employer_workspace_unlinked', expect.objectContaining({ refId: 'op1' }))
    expect(db.partnerAuditEvent.create.mock.calls[0][0].data).toMatchObject({ action: 'workspace.unlinked', refId: 'op1' })
  })
  it('search needs two letters, finds by name or contact, and marks records already used elsewhere', async () => {
    expect(await searchLinkableRecords('w1', 'a', db as never)).toEqual({ options: [] })
    expect(db.outplacementEmployerOrg.findMany).not.toHaveBeenCalled()
    db.orgWorkspace.findUnique.mockResolvedValue({ id: 'w1', type: 'OUTPLACEMENT' })
    db.outplacementEmployerOrg.findMany.mockResolvedValue([{ id: 'op1', name: 'Acme', primaryContactEmail: 'hr@acme.com' }, { id: 'op2', name: 'Acme East', primaryContactEmail: null }])
    db.orgWorkspace.findMany.mockResolvedValue([{ refId: 'op2' }])
    const r = await searchLinkableRecords('w1', 'acme', db as never)
    expect(r).toEqual({ options: [{ id: 'op1', name: 'Acme', contactEmail: 'hr@acme.com', linkedElsewhere: false }, { id: 'op2', name: 'Acme East', contactEmail: null, linkedElsewhere: true }] })
    expect(db.outplacementEmployerOrg.findMany.mock.calls[0][0].take).toBe(20)
    db.orgWorkspace.findUnique.mockResolvedValue({ id: 'w1', type: 'HIRING' })
    expect((await searchLinkableRecords('w1', 'acme', db as never)).error).toBeDefined()
  })
})

describe('team: add, change role, remove', () => {
  const sec = (type = 'OUTPLACEMENT') => db.orgWorkspace.findUnique.mockResolvedValue({ id: 'w1', orgId: 'o1', type, refId: null })

  it('adds a person with a role from that section, lower-cased, with no email in the event', async () => {
    sec()
    db.orgWorkspaceAdmin.findFirst.mockResolvedValue(null)
    const r = await actions.addSectionAdminAction('w1', '  Pat@Acme.COM ', 'LEGAL')
    expect(r.error).toBeUndefined()
    expect(db.orgWorkspaceAdmin.create.mock.calls[0][0].data).toEqual({ workspaceId: 'w1', email: 'pat@acme.com', role: 'LEGAL', source: 'INVITE', invitedBy: STAFF.id })
    expect(capture).toHaveBeenCalledWith(STAFF.id, 'employer_workspace_admin_added', { organizationId: 'o1', workspaceId: 'w1', section: 'outplacement', adminId: 'a-new', role: 'LEGAL', via: 'staff_form' })
    expect(db.partnerAuditEvent.create.mock.calls[0][0].data).toMatchObject({ action: 'workspace_team.added', targetId: 'a-new' })
  })
  it('rejects a role the section does not have, a bad address and a duplicate, and keeps the form input', async () => {
    sec('HIRING')
    db.orgWorkspaceAdmin.findFirst.mockResolvedValue(null)
    expect((await addWorkspaceAdmin({ workspaceId: 'w1', email: 'a@b.com', role: 'LEGAL', actor: { userId: 's', email: null } }, db as never)).error).toMatch(/ADMIN, VIEWER, BILLING/)
    expect((await addWorkspaceAdmin({ workspaceId: 'w1', email: 'not-an-email', role: 'ADMIN', actor: { userId: 's', email: null } }, db as never)).error).toMatch(/does not look like an email/)
    expect((await addWorkspaceAdmin({ workspaceId: 'w1', email: '  ', role: 'ADMIN', actor: { userId: 's', email: null } }, db as never)).error).toMatch(/Enter/)
    db.orgWorkspaceAdmin.findFirst.mockResolvedValue({ id: 'x' })
    expect((await addWorkspaceAdmin({ workspaceId: 'w1', email: 'a@b.com', role: 'ADMIN', actor: { userId: 's', email: null } }, db as never)).error).toMatch(/already on this team/)
    expect(db.orgWorkspaceAdmin.create).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
  })
  it('changes a role through the shared library without being an admin of the section, and records it', async () => {
    db.orgWorkspaceAdmin.findUnique.mockResolvedValue({ id: 'a1', workspaceId: 'w1', role: 'VIEWER', userId: null, email: 'v@acme.com', workspace: { type: 'OUTPLACEMENT', id: 'w1', orgId: 'o1', refId: 'op1' } })
    db.orgWorkspaceAdmin.count.mockResolvedValue(1)
    const r = await actions.setSectionAdminRoleAction('a1', 'FINANCE')
    expect(r.error).toBeUndefined()
    expect(db.orgWorkspaceAdmin.findFirst).not.toHaveBeenCalled()
    expect(db.orgWorkspaceAdmin.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { role: 'FINANCE' } })
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith(STAFF.id, 'employer_workspace_admin_role_changed', { organizationId: 'o1', workspaceId: 'w1', section: 'outplacement', adminId: 'a1', from: 'VIEWER', to: 'FINANCE' })
    expect(db.partnerAuditEvent.create.mock.calls[0][0].data).toMatchObject({ action: 'workspace_team.role_changed', refId: 'op1' })
  })
  it('never takes ADMIN from, or removes, the last active admin', async () => {
    db.orgWorkspaceAdmin.findUnique.mockResolvedValue({ id: 'a1', workspaceId: 'w1', role: 'ADMIN', userId: 'u-last', email: 'boss@acme.com', workspace: { type: 'HIRING', id: 'w1', orgId: 'o1', refId: null } })
    db.orgWorkspaceAdmin.count.mockResolvedValue(1)
    expect((await actions.removeSectionAdminAction('a1')).error).toMatch(/only active admin/)
    expect((await actions.setSectionAdminRoleAction('a1', 'VIEWER')).error).toMatch(/only active admin/)
    expect(db.orgWorkspaceAdmin.delete).not.toHaveBeenCalled()
    expect(db.orgWorkspaceAdmin.update).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
    expect(db.partnerAuditEvent.create).not.toHaveBeenCalled()
  })
  it('allows removing an admin when another admin remains, and removes a pending one when another admin remains', async () => {
    db.orgWorkspaceAdmin.findUnique.mockResolvedValue({ id: 'a1', workspaceId: 'w1', role: 'ADMIN', userId: 'u2', email: 'two@acme.com', workspace: { type: 'HIRING', id: 'w1', orgId: 'o1', refId: null } })
    db.orgWorkspaceAdmin.count.mockResolvedValue(2)
    const r = await actions.removeSectionAdminAction('a1')
    expect(r.message).toMatch(/no longer on the team/)
    expect(db.orgWorkspaceAdmin.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
    expect(capture).toHaveBeenCalledWith(STAFF.id, 'employer_workspace_admin_removed', { organizationId: 'o1', workspaceId: 'w1', section: 'hiring', adminId: 'a1', role: 'ADMIN', pending: false })
    // The audit entry lands under the workspace id (not linked), read before the row was deleted.
    expect(db.partnerAuditEvent.create.mock.calls[0][0].data).toMatchObject({ action: 'workspace_team.removed', refId: 'w1' })
    db.orgWorkspaceAdmin.findUnique.mockResolvedValue({ id: 'a2', workspaceId: 'w1', role: 'ADMIN', userId: null, email: 'wait@acme.com', workspace: { type: 'HIRING', id: 'w1', orgId: 'o1', refId: null } })
    db.orgWorkspaceAdmin.count.mockResolvedValue(2)
    expect((await actions.removeSectionAdminAction('a2')).error).toBeUndefined()
    // A sole admin who has not signed in yet is still the last admin: removing them would leave the section with none.
    db.orgWorkspaceAdmin.count.mockResolvedValue(1)
    expect((await actions.removeSectionAdminAction('a2')).error).toMatch(/only active admin/)
  })
  it('still never lets the staff member remove or demote their own admin row', async () => {
    db.orgWorkspaceAdmin.findUnique.mockResolvedValue({ id: 'a1', workspaceId: 'w1', role: 'ADMIN', userId: STAFF.id, email: 'staff@nextchapter.test', workspace: { type: 'HIRING', id: 'w1', orgId: 'o1', refId: null } })
    db.orgWorkspaceAdmin.count.mockResolvedValue(3)
    expect((await actions.removeSectionAdminAction('a1')).error).toMatch(/remove yourself/)
  })
  it('keeps the section’s own rule for its own admins: a non-admin, non-staff actor is refused', async () => {
    db.orgWorkspaceAdmin.findUnique.mockResolvedValue({ id: 'a1', workspaceId: 'w1', role: 'VIEWER', userId: 'u3', email: 'v@acme.com', workspace: { type: 'HIRING' } })
    db.orgWorkspaceAdmin.findFirst.mockResolvedValue(null)
    expect((await removeWorkspaceAdmin({ userId: 'u9', email: 'x@y.com' }, 'a1', db as never)).error).toMatch(/Only an admin of this section/)
    expect((await setWorkspaceAdminRole({ userId: 'u9', email: 'x@y.com' }, 'a1', 'ADMIN', db as never)).error).toMatch(/Only an admin of this section/)
    expect(db.orgWorkspaceAdmin.delete).not.toHaveBeenCalled()
    void staff
  })
})

describe('a pending request becomes an admin only when staff press Make admin', () => {
  const claim = (over = {}) => ({ id: 'c1', crmOrganizationId: 'crm1', section: 'employees', outcome: 'REQUESTED', verifiedAt: new Date(), email: 'Sam@Acme.com', ...over })
  const wire = () => {
    db.organization.findUnique.mockResolvedValue({ id: 'o1' })
    db.orgWorkspace.findUnique.mockImplementation(async (a: { where: Record<string, unknown> }) => (a.where.orgId_type ? { id: 'w2' } : { id: 'w2', orgId: 'o1', type: 'EMPLOYEES', refId: null }))
    db.orgWorkspaceAdmin.findFirst.mockResolvedValue(null)
  }
  it('adds the verified email as ADMIN with source DOMAIN_CLAIM, and reports the claim id, not the email', async () => {
    db.orgClaim.findUnique.mockResolvedValue(claim())
    wire()
    const r = await actions.makeAdminFromRequestAction('c1')
    expect(r.message).toMatch(/now an admin of Employees/)
    expect(db.orgWorkspaceAdmin.create.mock.calls[0][0].data).toEqual({ workspaceId: 'w2', email: 'sam@acme.com', role: 'ADMIN', source: 'DOMAIN_CLAIM', invitedBy: STAFF.id })
    expect(capture).toHaveBeenCalledWith(STAFF.id, 'employer_workspace_admin_added', { organizationId: 'o1', workspaceId: 'w2', section: 'employees', adminId: 'a-new', role: 'ADMIN', via: 'claim_request', claimId: 'c1' })
    for (const [, , props] of capture.mock.calls) expect(JSON.stringify(props)).not.toContain('@')
  })
  it('refuses anything that is not a verified REQUESTED claim, and nothing is created', async () => {
    wire()
    for (const over of [{ outcome: 'ADMIN' }, { outcome: 'REVIEW' }, { outcome: null }, { verifiedAt: null }, { section: null }]) {
      db.orgClaim.findUnique.mockResolvedValue(claim(over))
      expect((await makeAdminFromRequest({ claimId: 'c1', actor: { userId: 's', email: null } }, db as never)).error).toBeDefined()
    }
    db.orgClaim.findUnique.mockResolvedValue(null)
    expect((await makeAdminFromRequest({ claimId: 'c1', actor: { userId: 's', email: null } }, db as never)).error).toMatch(/no longer exists/)
    expect(db.orgWorkspaceAdmin.create).not.toHaveBeenCalled()
  })
  it('refuses when the organization or its section is gone, or the person is already on the team', async () => {
    db.orgClaim.findUnique.mockResolvedValue(claim())
    db.organization.findUnique.mockResolvedValue(null)
    expect((await makeAdminFromRequest({ claimId: 'c1', actor: { userId: 's', email: null } }, db as never)).error).toMatch(/organization/)
    wire()
    db.orgWorkspace.findUnique.mockResolvedValueOnce(null)
    expect((await makeAdminFromRequest({ claimId: 'c1', actor: { userId: 's', email: null } }, db as never)).error).toMatch(/does not exist/)
    wire()
    db.orgWorkspaceAdmin.findFirst.mockResolvedValue({ id: 'x' })
    expect((await makeAdminFromRequest({ claimId: 'c1', actor: { userId: 's', email: null } }, db as never)).error).toMatch(/already on this team/)
  })
})

describe('the staff view of each section', () => {
  const base = (over = {}) => ({ id: 'w1', type: 'EMPLOYEES', status: 'PENDING', refId: null, inviteEmail: null, admins: [], ...over })
  it('lists admins, the link state and only requests from people not already on the team', async () => {
    db.organization.findUnique.mockResolvedValue({ id: 'o1', crmOrganizationId: 'crm1' })
    db.orgWorkspace.findMany.mockResolvedValue([
      base({ refId: 'op1', admins: [{ id: 'a1', email: 'Boss@acme.com', role: 'ADMIN', source: 'DOMAIN_CLAIM', userId: null, acceptedAt: null, createdAt: new Date('2026-10-20T12:00:00Z') }] }),
      base({ id: 'w2', type: 'HIRING', inviteEmail: 'pat@acme.com' }),
    ])
    db.outplacementEmployerOrg.findMany.mockResolvedValue([{ id: 'op1', name: 'Acme', primaryContactEmail: 'hr@acme.com' }])
    db.employerProfile.findMany.mockResolvedValue([])
    db.orgClaim.findMany.mockResolvedValue([
      { id: 'c1', name: 'Boss', title: 'CHRO', email: 'boss@acme.com', createdAt: new Date() },
      { id: 'c2', name: 'Sam', title: 'HRBP', email: 'sam@acme.com', createdAt: new Date('2026-10-22T12:00:00Z') },
    ])
    const { views, error } = await loadStaffSectionViews('o1', db as never)
    expect(error).toBeUndefined()
    expect(views.map((v) => [v.section, v.status])).toEqual([['hiring', 'PENDING'], ['employees', 'PENDING']])
    const employees = views.find((v) => v.section === 'employees')!
    expect(employees.linkedRecord).toEqual({ id: 'op1', name: 'Acme', contactEmail: 'hr@acme.com' })
    expect(employees.admins[0]).toMatchObject({ email: 'Boss@acme.com', role: 'ADMIN', signedIn: false, accepted: false })
    expect(employees.requests.map((r) => r.claimId)).toEqual(['c2'])
    expect(employees.roles).toEqual(['ADMIN', 'VIEWER', 'BILLING'])
    const q = db.orgClaim.findMany.mock.calls.map((c) => c[0].where).find((w) => w.section === 'employees')
    expect(q).toMatchObject({ crmOrganizationId: 'crm1', section: 'employees', outcome: 'REQUESTED' })
    const hiring = views.find((v) => v.section === 'hiring')!
    expect(hiring.hiringSignedUp).toBe(false)
    expect(hiring.activateBlockedReason).toMatch(/pat@acme.com/)
  })
  it('shows a Hiring claimant who has signed up as linked', async () => {
    db.organization.findUnique.mockResolvedValue({ id: 'o1', crmOrganizationId: null })
    db.orgWorkspace.findMany.mockResolvedValue([base({ type: 'HIRING', status: 'ACTIVE', refId: 'e1', inviteEmail: 'pat@acme.com' })])
    db.outplacementEmployerOrg.findMany.mockResolvedValue([])
    db.employerProfile.findMany.mockResolvedValue([{ id: 'e1', companyName: 'Acme Inc' }])
    const { views } = await loadStaffSectionViews('o1', db as never)
    expect(views[0]).toMatchObject({ hiringSignedUp: true, hiringCompany: 'Acme Inc', activateBlockedReason: null, requests: [] })
  })
  it('fails soft: requests that cannot be read show a message and the rest still loads; a total failure returns an error', async () => {
    db.organization.findUnique.mockResolvedValue({ id: 'o1', crmOrganizationId: 'crm1' })
    db.orgWorkspace.findMany.mockResolvedValue([base()])
    db.outplacementEmployerOrg.findMany.mockResolvedValue([])
    db.employerProfile.findMany.mockResolvedValue([])
    db.orgClaim.findMany.mockRejectedValue(new Error('column OrgClaim.outcome does not exist'))
    const soft = await loadStaffSectionViews('o1', db as never)
    expect(soft.views[0].requestsError).toMatch(/could not be loaded/)
    expect(soft.views[0].requestsError).not.toMatch(/does not exist/)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    db.organization.findUnique.mockRejectedValue(new Error('down'))
    const hard = await loadStaffSectionViews('o1', db as never)
    expect(hard.views).toEqual([])
    expect(hard.error).toMatch(/could not be loaded/)
  })
})

describe('copy and scope', () => {
  it('shows no price or amount, and uses the real status values', () => {
    const src = readFileSync('src/components/admin/EmployerWorkspaceControls.tsx', 'utf8').replace(/\/\/.*$/gm, '')
    const copy = [...src.matchAll(/['"`]([^'"`\n]{6,})['"`]/g)].map((m) => m[1]).join('\n')
    expect(copy).not.toMatch(/\$\s?\d|\bper (seat|month|year)\b|\bUSD\b/i)
    expect(Object.keys({ PENDING: 1, ACTIVE: 1, SUSPENDED: 1 }).every((k) => src.includes(k))).toBe(true)
  })
  it('the staff library writes only status, refId and team rows: no contract, seat, org or Google call exists in it', () => {
    const src = readFileSync('src/lib/employer/staff-workspaces.ts', 'utf8').replace(/\/\/.*$/gm, '')
    expect(src).not.toMatch(/outplacementContract|outplacementOrgUser|employerSeat|outplacementEmployerOrg\.(create|update|delete)|googleapis|gmail|calendar/i)
  })
})
