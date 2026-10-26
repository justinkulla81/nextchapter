import 'server-only'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { isSectionRole, lastAdminBlock } from '@/lib/employer/section-roles'
import { sectionForWorkspaceType } from '@/lib/employer/sections'

// Managing who runs a section through the new OrgWorkspaceAdmin table. Every change here carries the same last-admin rule
// as outplacement's removeOrgUser (src/lib/employer/section-roles.ts lastAdminBlock): never yourself, never the last
// admin of the workspace. Only an ADMIN of the same workspace may change it. Staff use it from the organization page
// (`staff: true`); the Team pages of Hiring and Employees will call it as the section's own admin.

type Db = Pick<PrismaClient, 'orgWorkspaceAdmin'>

export interface WorkspaceActor {
  userId: string
  email: string | null
  /**
   * NextChapter staff acting from the admin screen (the caller has already passed requireAdmin). Staff need not be an admin
   * of the workspace, so the "only an admin of this section" check is skipped. The last-admin rules still apply in full,
   * and the staff member's own user id is the "yourself" the rule protects. The caller records its own event and audit
   * entry, so no event is sent from here; `detail` says what changed.
   */
  staff?: boolean
}

export interface WorkspaceAdminChange {
  error?: string
  /** Set for staff callers only. */
  detail?: { workspaceId: string; section: string | null; adminId: string; role: string; from?: string; to?: string; pending: boolean; email: string }
}

type Row = { id: string; workspaceId: string; role: string; userId: string | null; email: string; workspace: { type: string } }

async function load(db: Db, actor: WorkspaceActor, adminId: string): Promise<{ target: Row; activeAdmins: number } | { error: string }> {
  const target = (await db.orgWorkspaceAdmin.findUnique({
    where: { id: adminId },
    select: { id: true, workspaceId: true, role: true, userId: true, email: true, workspace: { select: { type: true } } },
  })) as Row | null
  if (!target) return { error: 'Already removed.' }
  const actorEmail = actor.email?.trim().toLowerCase() ?? null
  const isAdmin = actor.staff ? { id: 'staff' } : await db.orgWorkspaceAdmin.findFirst({
    where: {
      workspaceId: target.workspaceId,
      role: 'ADMIN',
      OR: [{ userId: actor.userId }, ...(actorEmail ? [{ userId: null, email: { equals: actorEmail, mode: 'insensitive' as const } }] : [])],
    },
    select: { id: true },
  })
  if (!isAdmin && !actor.staff) return { error: 'Only an admin of this section can do this.' }
  const activeAdmins = await db.orgWorkspaceAdmin.count({ where: { workspaceId: target.workspaceId, role: 'ADMIN' } })
  return { target, activeAdmins }
}

export async function removeWorkspaceAdmin(actor: WorkspaceActor, adminId: string, db: Db = prisma): Promise<WorkspaceAdminChange> {
  const loaded = await load(db, actor, adminId)
  if ('error' in loaded) return loaded
  const { target, activeAdmins } = loaded
  const blocked = lastAdminBlock(actor.userId, { userId: target.userId, role: target.role, active: true }, activeAdmins, 'remove')
  if (blocked) return { error: blocked }
  await db.orgWorkspaceAdmin.delete({ where: { id: target.id } })
  if (actor.staff) return { detail: { workspaceId: target.workspaceId, section: sectionForWorkspaceType(target.workspace.type)?.key ?? null, adminId: target.id, role: target.role, pending: !target.userId, email: target.email } }
  captureServerEvent(actor.userId, 'employer_section_admin_removed', { workspaceId: target.workspaceId, section: sectionForWorkspaceType(target.workspace.type)?.key ?? null, role: target.role, pending: !target.userId })
  return {}
}

export async function setWorkspaceAdminRole(actor: WorkspaceActor, adminId: string, role: string, db: Db = prisma): Promise<WorkspaceAdminChange> {
  const loaded = await load(db, actor, adminId)
  if ('error' in loaded) return loaded
  const { target, activeAdmins } = loaded
  const section = sectionForWorkspaceType(target.workspace.type)
  if (!section) return { error: 'This is not an employer section.' }
  if (!isSectionRole(section.key, role)) return { error: 'That role does not exist in this section.' }
  if (role === target.role) return actor.staff ? { detail: { workspaceId: target.workspaceId, section: section.key, adminId: target.id, role, from: role, to: role, pending: !target.userId, email: target.email } } : {}
  // Taking ADMIN away is held to the same rule as removing the person.
  if (target.role === 'ADMIN' && role !== 'ADMIN') {
    const blocked = lastAdminBlock(actor.userId, { userId: target.userId, role: target.role, active: true }, activeAdmins, 'change_role')
    if (blocked) return { error: blocked }
  }
  await db.orgWorkspaceAdmin.update({ where: { id: target.id }, data: { role } })
  if (actor.staff) return { detail: { workspaceId: target.workspaceId, section: section.key, adminId: target.id, role, from: target.role, to: role, pending: !target.userId, email: target.email } }
  captureServerEvent(actor.userId, 'employer_section_role_changed', { workspaceId: target.workspaceId, section: section.key, from: target.role, to: role })
  return {}
}
