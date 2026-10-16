import 'server-only'
import type { OrgWorkspaceType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// One audit trail for every partner portal. Recording is best-effort: a failure
// to log must never break the action being logged.

export interface AuditInput {
  portal: OrgWorkspaceType
  /** The portal's own record id: outplacement org, coach, firm, employer or institution. */
  refId: string
  actorUserId?: string | null
  actorLabel?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  detail?: Prisma.InputJsonObject | null
}

export async function recordPartnerAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.partnerAuditEvent.create({
      data: {
        portal: input.portal,
        refId: input.refId,
        actorUserId: input.actorUserId ?? null,
        actorLabel: input.actorLabel ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        detail: input.detail ?? undefined,
      },
    })
  } catch (error) {
    console.error('Failed to record partner audit event:', error)
  }
}

export async function listPartnerAudit(portal: OrgWorkspaceType, refId: string, take = 100) {
  return prisma.partnerAuditEvent.findMany({ where: { portal, refId }, orderBy: { createdAt: 'desc' }, take })
}
