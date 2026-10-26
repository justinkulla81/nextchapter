'use server'

import { revalidatePath } from 'next/cache'
import type { OrgWorkspaceType } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { recordPartnerAudit } from '@/lib/partners/audit'
import { removeWorkspaceAdmin, setWorkspaceAdminRole } from '@/lib/employer/workspace-admins'
import {
  addWorkspaceAdmin,
  linkWorkspaceRecord,
  makeAdminFromRequest,
  searchLinkableRecords,
  setWorkspaceStatus,
  workspaceOfAdmin,
  type RecordOption,
} from '@/lib/employer/staff-workspaces'

// Staff controls for an employer organization's sections: status, linked record and team. Every action asks requireAdmin()
// first, the same gate as the plan actions in ./actions.ts. Each one records an audit entry (on the section's portal record
// when it is linked, otherwise on the workspace itself) and a PostHog event that carries ids only, never an email.
// Nothing here changes a login, cookie or middleware, and nothing writes to any Google account.

export type WorkspaceActionResult = { error?: string; message?: string }

const GENERIC_ERROR = 'Something went wrong on our side. Reload the page and try again.'

function sectionName(key: string): string {
  return key === 'hiring' ? 'Hiring' : key === 'employees' ? 'Employees' : 'Outplacement'
}

async function audit(portal: string, refId: string, actorEmail: string | null, actorUserId: string, action: string, targetId: string | null, detail: Record<string, string | boolean | null>) {
  await recordPartnerAudit({
    portal: portal as OrgWorkspaceType,
    refId,
    actorUserId,
    actorLabel: actorEmail ? `${actorEmail} (NextChapter staff)` : 'NextChapter staff',
    action,
    targetType: 'workspace',
    targetId,
    detail,
  })
}

const refresh = (organizationId: string) => revalidatePath(`/support/admin/organizations/${organizationId}`)

export async function setSectionStatusAction(workspaceId: string, to: 'ACTIVE' | 'SUSPENDED'): Promise<WorkspaceActionResult> {
  const admin = await requireAdmin()
  try {
    const r = await setWorkspaceStatus({ workspaceId, to })
    if (r.error !== undefined) return { error: r.error }
    const c = r.change
    if (!c.changed) return { message: to === 'ACTIVE' ? 'This section is already active.' : 'This section is already suspended.' }
    const event = to === 'ACTIVE' ? 'employer_workspace_activated' : 'employer_workspace_suspended'
    captureServerEvent(admin.id, event, { organizationId: c.organizationId, workspaceId: c.workspaceId, section: c.section, from: c.from, adminCount: c.adminCount })
    await audit(c.auditPortal, c.auditRefId, admin.email ?? null, admin.id, to === 'ACTIVE' ? 'workspace.activated' : 'workspace.suspended', c.workspaceId, { section: c.section, from: c.from, to })
    refresh(c.organizationId)
    return { message: to === 'ACTIVE' ? `${sectionName(c.section)} is active. Its admins can now sign in to it.` : `${sectionName(c.section)} is suspended. Its admins can no longer sign in to it.` }
  } catch (e) {
    console.error('setSectionStatusAction failed:', e)
    return { error: GENERIC_ERROR }
  }
}

export async function searchLinkableRecordsAction(workspaceId: string, query: string): Promise<{ error?: string; options?: RecordOption[] }> {
  await requireAdmin()
  try {
    const r = await searchLinkableRecords(workspaceId, query)
    return r.error !== undefined ? { error: r.error } : { options: r.options }
  } catch (e) {
    console.error('searchLinkableRecordsAction failed:', e)
    return { error: 'The search failed. Try again.' }
  }
}

export async function linkSectionRecordAction(workspaceId: string, recordId: string | null): Promise<WorkspaceActionResult> {
  const admin = await requireAdmin()
  try {
    const r = await linkWorkspaceRecord({ workspaceId, recordId })
    if (r.error !== undefined) return { error: r.error }
    const c = r.change
    if (c.recordId === c.previousRecordId) return { message: recordId ? 'That record is already linked.' : 'This section was not linked to a record.' }
    captureServerEvent(admin.id, recordId ? 'employer_workspace_linked' : 'employer_workspace_unlinked', {
      organizationId: c.organizationId,
      workspaceId: c.workspaceId,
      section: c.section,
      refId: c.recordId ?? c.previousRecordId,
    })
    await audit(c.auditPortal, c.auditRefId, admin.email ?? null, admin.id, recordId ? 'workspace.linked' : 'workspace.unlinked', c.workspaceId, { section: c.section, refId: c.recordId ?? c.previousRecordId, ...(c.recordName ? { recordName: c.recordName } : {}) })
    refresh(c.organizationId)
    return { message: recordId ? `${sectionName(c.section)} is now linked to ${c.recordName}.` : `${sectionName(c.section)} is no longer linked to a record.` }
  } catch (e) {
    console.error('linkSectionRecordAction failed:', e)
    return { error: GENERIC_ERROR }
  }
}

export async function addSectionAdminAction(workspaceId: string, email: string, role: string): Promise<WorkspaceActionResult> {
  const admin = await requireAdmin()
  try {
    const r = await addWorkspaceAdmin({ workspaceId, email, role, actor: { userId: admin.id, email: admin.email ?? null } })
    if (r.error !== undefined) return { error: r.error }
    const a = r.added
    captureServerEvent(admin.id, 'employer_workspace_admin_added', { organizationId: a.organizationId, workspaceId: a.workspaceId, section: a.section, adminId: a.adminId, role: a.role, via: 'staff_form' })
    await audit(a.auditPortal, a.auditRefId, admin.email ?? null, admin.id, 'workspace_team.added', a.adminId, { section: a.section, role: a.role, email: a.email })
    refresh(a.organizationId)
    return { message: `${a.email} is on the ${sectionName(a.section)} team as ${a.role.toLowerCase()}. They get in when they sign in with that email and the section is active.` }
  } catch (e) {
    console.error('addSectionAdminAction failed:', e)
    return { error: GENERIC_ERROR }
  }
}

export async function makeAdminFromRequestAction(claimId: string): Promise<WorkspaceActionResult> {
  const admin = await requireAdmin()
  try {
    const r = await makeAdminFromRequest({ claimId, actor: { userId: admin.id, email: admin.email ?? null } })
    if (r.error !== undefined) return { error: r.error }
    const a = r.added
    captureServerEvent(admin.id, 'employer_workspace_admin_added', { organizationId: a.organizationId, workspaceId: a.workspaceId, section: a.section, adminId: a.adminId, role: a.role, via: 'claim_request', claimId })
    await audit(a.auditPortal, a.auditRefId, admin.email ?? null, admin.id, 'workspace_team.added', a.adminId, { section: a.section, role: a.role, email: a.email, claimId })
    refresh(a.organizationId)
    return { message: `${a.email} is now an admin of ${sectionName(a.section)}.` }
  } catch (e) {
    console.error('makeAdminFromRequestAction failed:', e)
    return { error: GENERIC_ERROR }
  }
}

export async function setSectionAdminRoleAction(adminId: string, role: string): Promise<WorkspaceActionResult> {
  const admin = await requireAdmin()
  try {
    const where = await workspaceOfAdmin(adminId)
    const r = await setWorkspaceAdminRole({ userId: admin.id, email: admin.email ?? null, staff: true }, adminId, role)
    if (r.error !== undefined) return { error: r.error }
    const d = r.detail
    if (!d || !where) return { message: 'Role saved.' }
    if (d.from === d.to) return { message: 'That is already their role.' }
    captureServerEvent(admin.id, 'employer_workspace_admin_role_changed', { organizationId: where.organizationId, workspaceId: d.workspaceId, section: d.section, adminId: d.adminId, from: d.from ?? null, to: d.to ?? null })
    await audit(where.auditPortal, where.auditRefId, admin.email ?? null, admin.id, 'workspace_team.role_changed', d.adminId, { section: d.section, from: d.from ?? null, to: d.to ?? null, email: d.email })
    refresh(where.organizationId)
    return { message: `${d.email} is now ${String(d.to).toLowerCase()}.` }
  } catch (e) {
    console.error('setSectionAdminRoleAction failed:', e)
    return { error: GENERIC_ERROR }
  }
}

export async function removeSectionAdminAction(adminId: string): Promise<WorkspaceActionResult> {
  const admin = await requireAdmin()
  try {
    // Read before the row is deleted: the audit entry needs to know where it belongs.
    const where = await workspaceOfAdmin(adminId)
    const r = await removeWorkspaceAdmin({ userId: admin.id, email: admin.email ?? null, staff: true }, adminId)
    if (r.error !== undefined) return { error: r.error }
    const d = r.detail
    if (!d || !where) return { message: 'Removed.' }
    captureServerEvent(admin.id, 'employer_workspace_admin_removed', { organizationId: where.organizationId, workspaceId: d.workspaceId, section: d.section, adminId: d.adminId, role: d.role, pending: d.pending })
    await audit(where.auditPortal, where.auditRefId, admin.email ?? null, admin.id, 'workspace_team.removed', d.adminId, { section: d.section, role: d.role, email: d.email })
    refresh(where.organizationId)
    return { message: `${d.email} is no longer on the team.` }
  } catch (e) {
    console.error('removeSectionAdminAction failed:', e)
    return { error: GENERIC_ERROR }
  }
}
