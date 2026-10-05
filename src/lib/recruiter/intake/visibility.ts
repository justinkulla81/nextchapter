// Who can see which NextChapter Talent connections. Pure (no Next.js or
// session imports) so scripts and tests can use the same rule.
import type { Prisma, Recruiter, RecruiterFirm } from '@prisma/client'

export type TalentContext = {
  recruiter: Recruiter
  firm: RecruiterFirm | null
  role: Recruiter['firmRole']
}

export function visibleConnectionsWhere(ctx: TalentContext): Prisma.IntakeConnectionWhereInput {
  if (!ctx.firm) return { id: '__none__' }
  const base: Prisma.IntakeConnectionWhereInput = { firmId: ctx.firm.id, disconnectedAt: null }
  if (ctx.role === 'ADMIN' && ctx.firm.intakeAdminSeesAll) return base
  if (ctx.role === 'ADMIN' || ctx.role === 'COORDINATOR') {
    return { ...base, OR: [{ recruiterId: null }, { recruiterId: ctx.recruiter.id }] }
  }
  return { ...base, recruiterId: ctx.recruiter.id }
}

