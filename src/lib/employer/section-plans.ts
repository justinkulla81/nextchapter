import 'server-only'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { isWorkspacePlan } from '@/lib/employer/plans'
import { sectionForWorkspaceType } from '@/lib/employer/sections'

// What staff can set on an employer organization: one plan per section workspace, and the enterprise package for the whole
// organization. Staff only (the admin actions call requireAdmin first). No payment code: this records a label and who set it.

type Db = Pick<PrismaClient, 'orgWorkspace' | 'organization'>

export async function setWorkspacePlan(input: { workspaceId: string; plan: string; note?: string | null; actor: string | null }, db: Db = prisma): Promise<{ error?: string; organizationId?: string }> {
  if (!isWorkspacePlan(input.plan)) return { error: 'Choose one of the plans.' }
  const ws = await db.orgWorkspace.findUnique({ where: { id: input.workspaceId }, select: { id: true, orgId: true, type: true, plan: true, org: { select: { enterprise: true } } } })
  if (!ws) return { error: 'This section no longer exists.' }
  const section = sectionForWorkspaceType(ws.type)
  if (!section) return { error: 'Plans are set only on the Hiring, Employees and Outplacement sections.' }
  if (input.plan === 'ENTERPRISE' && !ws.org.enterprise) return { error: 'Turn on the enterprise package for this organization first.' }
  await db.orgWorkspace.update({
    where: { id: ws.id },
    data: { plan: input.plan, planSource: 'STAFF', planUpdatedAt: new Date(), planNote: input.note?.trim().slice(0, 500) || null },
  })
  captureServerEvent(input.actor ?? 'staff', 'employer_section_plan_set', { organizationId: ws.orgId, workspaceId: ws.id, section: section.key, from: ws.plan, to: input.plan })
  return { organizationId: ws.orgId }
}

export async function setOrganizationEnterprise(input: { organizationId: string; on: boolean; actor: string | null }, db: Db = prisma): Promise<{ error?: string }> {
  const org = await db.organization.findUnique({ where: { id: input.organizationId }, select: { id: true, enterprise: true, enterpriseSince: true } })
  if (!org) return { error: 'Organization not found.' }
  if (org.enterprise === input.on) return {}
  await db.organization.update({ where: { id: org.id }, data: { enterprise: input.on, enterpriseSince: input.on ? (org.enterpriseSince ?? new Date()) : null } })
  let reset = 0
  if (!input.on) {
    // A section that was marked Enterprise goes back to Free; staff then pick the plan it should be on.
    const r = await db.orgWorkspace.updateMany({
      where: { orgId: org.id, plan: 'ENTERPRISE' },
      data: { plan: 'FREE', planSource: 'STAFF', planUpdatedAt: new Date(), planNote: 'Enterprise package turned off' },
    })
    reset = r.count
  }
  captureServerEvent(input.actor ?? 'staff', 'employer_enterprise_set', { organizationId: org.id, enterprise: input.on, sectionsReset: reset })
  return {}
}
