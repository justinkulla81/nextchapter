import 'server-only'
import type { Prisma } from '@prisma/client'
import { recordPartnerAudit } from '@/lib/partners/audit'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { auditPortalOf } from '@/lib/higher-ed/workspaces'

// One line in the college's or workforce organization's own activity log (Admin > Activity): who did what. Best effort,
// like every partner audit write: a failure to log never breaks the action.
export function recordInstitutionAudit(
  ctx: WorkspaceContext,
  action: string,
  target?: { type: string; id?: string | null; detail?: Prisma.InputJsonObject },
): Promise<void> {
  return recordPartnerAudit({
    portal: auditPortalOf(ctx.institution.orgType),
    refId: ctx.institution.id,
    actorUserId: ctx.userId,
    actorLabel: ctx.email ?? null,
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    detail: target?.detail ?? null,
  })
}
