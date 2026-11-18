import 'server-only'
import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FREE_VISIBLE_MEMBERS, planOf } from './entitlements'

// Which of an organization's members its staff may see by name.
//  - The free plan (owner decision 2026-11-17): anyone can join, but staff see only the first FREE_VISIBLE_MEMBERS people
//    (the earliest added, in the order invites go out). Everyone else is still a member and in the counts.
//  - Schools and departments (owner decision 2026-11-18): staff whose seats are limited to units (InstitutionUnit) see only
//    the alumni whose roster school (and department, when the unit names one) match, under the units' plan.
//
// Every staff-facing read of individual members passes through one of these. Privacy-rights reads (a person's own data,
// FERPA access requests) and member-to-member features are not filtered: they are not the organization looking at people.

export type UnitFilter = { school: string; department: string | null }
type PlanCtx = { institution: { id: string; plan?: string | null }; units?: UnitFilter[] | null }

// The InstitutionMember `where` for a set of units; {} for the whole institution.
export function unitMemberWhere(units: UnitFilter[] | null | undefined): Prisma.InstitutionMemberWhereInput {
  if (!units?.length) return {}
  return {
    OR: units.map((u) => ({
      school: { equals: u.school, mode: 'insensitive' as const },
      ...(u.department ? { department: { equals: u.department, mode: 'insensitive' as const } } : {}),
    })),
  }
}

const unitsKey = (units: UnitFilter[] | null | undefined) => (units?.length ? JSON.stringify(units.map((u) => [u.school, u.department])) : '')

// The ids staff may see, or null when there is no limit (the paid plan for the whole institution). One read per request.
// A unit's alumni are listed in full on the paid plan (a school's roster; bounded at 20,000).
export const visibleMemberIds = cache(async (institutionId: string, plan: string | null | undefined, unitKey = ''): Promise<string[] | null> => {
  const units: UnitFilter[] = unitKey ? (JSON.parse(unitKey) as [string, string | null][]).map(([school, department]) => ({ school, department })) : []
  const free = planOf(plan) === 'FREE'
  if (!free && units.length === 0) return null
  const rows = await prisma.institutionMember.findMany({
    where: { institutionId, ...unitMemberWhere(units) },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: free ? FREE_VISIBLE_MEMBERS : 20_000,
    select: { id: true },
  })
  return rows.map((r) => r.id)
})

export const visibleIdsFor = (ctx: PlanCtx) => visibleMemberIds(ctx.institution.id, ctx.institution.plan, unitsKey(ctx.units))

const asSql = (ids: string[] | null, column: Prisma.Sql): Prisma.Sql =>
  ids === null ? Prisma.empty : ids.length === 0 ? Prisma.sql`and false` : Prisma.sql`and ${column} in (${Prisma.join(ids)})`

// A raw-SQL condition on a member id column: empty when there is no limit, `and <col> in (ids)` otherwise.
export async function visibleMemberSql(ctx: PlanCtx, column: Prisma.Sql = Prisma.sql`"memberId"`): Promise<Prisma.Sql> {
  return asSql(await visibleIdsFor(ctx), column)
}

// A Prisma `where` on a member id field: {} when there is no limit, { [field]: { in: ids } } otherwise.
export async function visibleMemberWhere<K extends string>(ctx: PlanCtx, field: K): Promise<Partial<Record<K, { in: string[] }>>> {
  const ids = await visibleIdsFor(ctx)
  return ids === null ? {} : ({ [field]: { in: ids } } as Record<K, { in: string[] }>)
}

// How many members (of the person's units, when limited) staff cannot see by name on the free plan. For the
// "N more joined" note; 0 on the paid plan.
export async function hiddenMemberCount(ctx: PlanCtx): Promise<number> {
  if (planOf(ctx.institution.plan) !== 'FREE') return 0
  const ids = await visibleIdsFor(ctx)
  const total = await prisma.institutionMember.count({ where: { institutionId: ctx.institution.id, ...unitMemberWhere(ctx.units) } })
  return Math.max(0, total - (ids?.length ?? 0))
}

// For readers that take only the institution id: the plan, and the signed-in staff member's units, are looked up once per
// request. Outside a request (a cron or a script) there is no person, so the institution's own plan applies.
const institutionFor = cache(async (institutionId: string) => prisma.institution.findUnique({ where: { id: institutionId }, select: { plan: true, slug: true } }))
const currentScope = cache(async (institutionId: string): Promise<{ plan: string | null; units: UnitFilter[] | null }> => {
  const inst = await institutionFor(institutionId)
  if (!inst) return { plan: null, units: null }
  try {
    const { getInstitutionAccess } = await import('@/lib/higher-ed/access')
    const access = await getInstitutionAccess(inst.slug)
    if (access && access !== 'signed-out' && access.institution.id === institutionId) return { plan: access.institution.plan, units: access.units ?? null }
  } catch {
    /* no request (cron, script): the institution's plan, no unit */
  }
  return { plan: inst.plan, units: null }
})

export async function visibleIdsForInstitution(institutionId: string): Promise<string[] | null> {
  const scope = await currentScope(institutionId)
  return visibleMemberIds(institutionId, scope.plan, unitsKey(scope.units))
}

// Raw-SQL condition for an institution id (see visibleMemberSql).
export async function visibleMemberSqlFor(institutionId: string, column: Prisma.Sql): Promise<Prisma.Sql> {
  return asSql(await visibleIdsForInstitution(institutionId), column)
}
