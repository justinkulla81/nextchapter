import 'server-only'
import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FREE_VISIBLE_MEMBERS, planOf } from './entitlements'

// Owner decision 2026-11-17: on the free plan anyone can join an organization, but its staff see only the first
// FREE_VISIBLE_MEMBERS people (the earliest added, in the order invites go out). Everyone else is still a member, gets
// every candidate tool, and shows up in counts; staff see their names once the organization is on the paid plan.
//
// Every staff-facing read of individual members passes through one of these. Privacy-rights reads (a person's own data,
// FERPA access requests) and member-to-member features are not filtered: they are not the organization looking at people.

type PlanCtx = { institution: { id: string; plan?: string | null } }

// The ids staff may see, or null when there is no limit (the paid plan). One read per request.
export const visibleMemberIds = cache(async (institutionId: string, plan: string | null | undefined): Promise<string[] | null> => {
  if (planOf(plan) !== 'FREE') return null
  const rows = await prisma.institutionMember.findMany({
    where: { institutionId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: FREE_VISIBLE_MEMBERS,
    select: { id: true },
  })
  return rows.map((r) => r.id)
})

export const visibleIdsFor = (ctx: PlanCtx) => visibleMemberIds(ctx.institution.id, ctx.institution.plan)

// A raw-SQL condition on a member id column: empty on the paid plan, `and <col> = any(ids)` on the free plan.
export async function visibleMemberSql(ctx: PlanCtx, column: Prisma.Sql = Prisma.sql`"memberId"`): Promise<Prisma.Sql> {
  const ids = await visibleIdsFor(ctx)
  if (ids === null) return Prisma.empty
  if (ids.length === 0) return Prisma.sql`and false`
  return Prisma.sql`and ${column} in (${Prisma.join(ids)})`
}

// A Prisma `where` on a member id field: {} on the paid plan, { [field]: { in: ids } } on the free plan.
export async function visibleMemberWhere<K extends string>(ctx: PlanCtx, field: K): Promise<Partial<Record<K, { in: string[] }>>> {
  const ids = await visibleIdsFor(ctx)
  return ids === null ? {} : ({ [field]: { in: ids } } as Record<K, { in: string[] }>)
}

// How many members staff cannot see on the free plan (0 on paid). For the "N more joined" note.
export async function hiddenMemberCount(ctx: PlanCtx): Promise<number> {
  const ids = await visibleIdsFor(ctx)
  if (ids === null) return 0
  const total = await prisma.institutionMember.count({ where: { institutionId: ctx.institution.id } })
  return Math.max(0, total - ids.length)
}

// For readers that take only the institution id: the plan is looked up once per request.
const planFor = cache(async (institutionId: string) => (await prisma.institution.findUnique({ where: { id: institutionId }, select: { plan: true } }))?.plan ?? null)
export async function visibleIdsForInstitution(institutionId: string): Promise<string[] | null> {
  return visibleMemberIds(institutionId, await planFor(institutionId))
}
// Raw-SQL condition for an institution id (see visibleMemberSql).
export async function visibleMemberSqlFor(institutionId: string, column: Prisma.Sql): Promise<Prisma.Sql> {
  const ids = await visibleIdsForInstitution(institutionId)
  if (ids === null) return Prisma.empty
  if (ids.length === 0) return Prisma.sql`and false`
  return Prisma.sql`and ${column} in (${Prisma.join(ids)})`
}
