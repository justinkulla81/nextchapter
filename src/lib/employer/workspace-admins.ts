import 'server-only'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { isSectionRole, lastAdminBlock } from '@/lib/employer/section-roles'
import { sectionForWorkspaceType } from '@/lib/employer/sections'

// Managing who runs a section through the new OrgWorkspaceAdmin table. Every change here carries the same last-admin rule
// as outplacement's removeOrgUser (src/lib/employer/section-roles.ts lastAdminBlock): never yourself, never the last active
// admin of the workspace. Only an ADMIN of the same workspace may change it. There is no screen for this yet; it is the
// library the Team pages of Hiring and Employees will call.

type Db = Pick<PrismaClient, 'orgWorkspaceAdmin'>

export interface WorkspaceActor {
  userId: string
  email: string | null
}

type Row = { id: string; workspaceId: string; role: string; userId: string | null; email: string; workspace: { type: string } }

async function load(db: Db, actor: WorkspaceActor, adminId: string): Promise<{ target: Row; activeAdmins: number } | { error: string }> {
  const target = (await db.orgWorkspaceAdmin.findUnique({
    where: { id: adminId },
    select: { id: true, workspaceId: true, role: true, userId: true, email: true, workspace: { select: { type: true } } },
  })) as Row | null
  if (!target) return { error: 'Already removed.' }
  const actorEmail = actor.email?.trim().toLowerCase() ?? null
  const isAdmin = await db.orgWorkspaceAdmin.findFirst({
    where: {
      workspaceId: target.workspaceId,
      role: 'ADMIN',
      OR: [{ userId: actor.userId }, ...(actorEmail ? [{ userId: null, email: { equals: actorEmail, mode: 'insensitive' as const } }] : [])],
    },
    select: { id: true },
  })
  if (!isAdmin) return { error: 'Only an admin of this section can do this.' }
  const activeAdmins = await db.orgWorkspaceAdmin.count({ where: { workspaceId: target.workspaceId, role: 'ADMIN', userId: { not: null } } })
  return { target, activeAdmins }
}

export async function removeWorkspaceAdmin(actor: WorkspaceActor, adminId: string, db: Db = prisma): Promise<{ error?: string }> {
  const loaded = await load(db, actor, adminId)
  if ('error' in loaded) return loaded
  const { target, activeAdmins } = loaded
  const blocked = lastAdminBlock(actor.userId, { userId: target.userId, role: target.role, active: !!target.userId }, activeAdmins, 'remove')
  if (blocked) return { error: blocked }
  await db.orgWorkspaceAdmin.delete({ where: { id: target.id } })
  captureServerEvent(actor.userId, 'employer_section_admin_removed', { workspaceId: target.workspaceId, section: sectionForWorkspaceType(target.workspace.type)?.key ?? null, role: target.role, pending: !target.userId })
  return {}
}

export async function setWorkspaceAdminRole(actor: WorkspaceActor, adminId: string, role: string, db: Db = prisma): Promise<{ error?: string }> {
  const loaded = await load(db, actor, adminId)
  if ('error' in loaded) return loaded
  const { target, activeAdmins } = loaded
  const section = sectionForWorkspaceType(target.workspace.type)
  if (!section) return { error: 'This is not an employer section.' }
  if (!isSectionRole(section.key, role)) return { error: 'That role does not exist in this section.' }
  if (role === target.role) return {}
  // Taking ADMIN away is held to the same rule as removing the person.
  if (target.role === 'ADMIN' && role !== 'ADMIN') {
    const blocked = lastAdminBlock(actor.userId, { userId: target.userId, role: target.role, active: !!target.userId }, activeAdmins, 'change_role')
    if (blocked) return { error: blocked }
  }
  await db.orgWorkspaceAdmin.update({ where: { id: target.id }, data: { role } })
  captureServerEvent(actor.userId, 'employer_section_role_changed', { workspaceId: target.workspaceId, section: section.key, from: target.role, to: role })
  return {}
}
