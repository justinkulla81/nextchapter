// Higher Ed audit trail (spec §8): every staff view of an individual member
// and every nc_admin "View as" on a real tenant writes an AdminAccessLog
// row. "Who viewed my profile" reads these back, showing the workspace and
// date only, never the staff member's name.

import 'server-only'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { InstitutionAccess } from './resolve'
import { VIEW_AS_SURFACE } from './resolve'
import { validateAdminAccessReason } from '@/lib/admin/access-log'

type Db = PrismaClient | Prisma.TransactionClient

export async function logMemberView(
  ctx: Pick<InstitutionAccess, 'institution' | 'email' | 'userId'> & { workspace?: string },
  memberId: string,
  db: Db = prisma,
): Promise<void> {
  const member = await db.institutionMember.findFirst({
    where: { id: memberId, institutionId: ctx.institution.id },
    select: { candidateId: true },
  })
  if (!member) return
  await db.adminAccessLog.create({
    data: {
      adminEmail: ctx.email ?? ctx.userId,
      viewedInstitutionId: ctx.institution.id,
      viewedInstitutionMemberId: memberId,
      viewedCandidateId: member.candidateId,
      surface: ctx.workspace ?? 'institution',
      reason: `${ctx.workspace ?? 'institution'} member view`,
    },
  })
}

// Starts an nc_admin View-as on a real tenant. The row itself is the
// session: requireWorkspace() honors it for VIEW_AS_TTL_MS.
export async function logViewAs(
  args: { institutionId: string; adminEmail: string; reason: string },
  db: Db = prisma,
): Promise<{ error: string } | { ok: true }> {
  const reason = validateAdminAccessReason(args.reason)
  if (!reason) return { error: 'Give a reason for viewing this institution as an admin.' }
  await db.adminAccessLog.create({
    data: {
      adminEmail: args.adminEmail,
      viewedInstitutionId: args.institutionId,
      surface: VIEW_AS_SURFACE,
      reason,
    },
  })
  return { ok: true }
}

export type ProfileView = { workspace: string; viewedAt: Date }

// For the member's own "Who viewed my profile" (spec §5.1): workspace and
// date, no names.
export async function listProfileViews(memberId: string, db: Db = prisma): Promise<ProfileView[]> {
  const rows = await db.adminAccessLog.findMany({
    where: { viewedInstitutionMemberId: memberId },
    select: { surface: true, viewedAt: true },
    orderBy: { viewedAt: 'desc' },
    take: 100,
  })
  return rows.map((r) => ({ workspace: r.surface, viewedAt: r.viewedAt }))
}
