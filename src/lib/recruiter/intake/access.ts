import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentRecruiter } from '@/lib/recruiter/current-recruiter'
import { visibleConnectionsWhere, type TalentContext } from './visibility'

export { visibleConnectionsWhere, type TalentContext }

// Who can see what in NextChapter Talent (spec "Key rules"):
//   - A recruiter sees only connections assigned to them.
//   - Coordinators (and admins) also see the firm's general hopper.
//   - Admins see every firm connection when the firm turns that on.
//   - Nothing ever crosses firms. Disconnected candidates drop out.

export async function getTalentContext(): Promise<TalentContext> {
  const recruiter = await getCurrentRecruiter()
  const firm =
    recruiter.recruiterFirmId && recruiter.firmRole
      ? await prisma.recruiterFirm.findUnique({ where: { id: recruiter.recruiterFirmId } })
      : null
  return { recruiter, firm, role: firm ? recruiter.firmRole : null }
}

export function canManageFirm(ctx: TalentContext): boolean {
  return !!ctx.firm && ctx.role === 'ADMIN'
}

export function canAssign(ctx: TalentContext): boolean {
  return !!ctx.firm && (ctx.role === 'ADMIN' || ctx.role === 'COORDINATOR')
}

// Returns the connection only if this recruiter may see it — otherwise null,
// indistinguishable from "doesn't exist".
export async function findVisibleConnection<T extends Prisma.IntakeConnectionInclude>(
  ctx: TalentContext,
  connectionId: string,
  include: T
) {
  return prisma.intakeConnection.findFirst({
    where: { AND: [visibleConnectionsWhere(ctx), { id: connectionId }] },
    include,
  })
}
