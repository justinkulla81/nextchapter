// Auto-join alumni groups by major, school (college) or department. A group
// lists what it is for (AlumniGroup.majors, schools, departments; all
// normalized); every JOINED member of the college whose roster value matches
// any of them is added as a MEMBER, joinedVia AUTO_MAJOR, AUTO_SCHOOL or
// AUTO_DEPARTMENT.
//
// Rules:
// - Joined members only (candidateId set, CLAIMED or ACTIVE). An imported
//   alum who has not joined NextChapter is never put in a group: the college
//   sees nothing of theirs until they agree (see join.ts).
// - A member who left a group (AlumniGroupLeave) is never added back. Joining
//   by click again removes the leave row.
// - One INSERT ... SELECT per call; it returns no rows, only a count, so a run
//   costs one statement's buffers and no egress.

import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
export { normalizeMajor, parseMajors } from './major-groups-shared'

export type AutoJoinScope = { institutionId?: string; groupId?: string; memberId?: string }
export type AutoJoinField = 'major' | 'school' | 'department'

// The SQL twin of normalizeMajor(): lower case, "&" as "and", punctuation
// dropped, spaces collapsed.
const norm = (col: Prisma.Sql) => Prisma.sql`btrim(regexp_replace(regexp_replace(replace(lower(${col}), '&', ' and '), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g'))`

/** Adds every matching joined member to every auto-join group in scope. Returns how many memberships were created. */
export async function autoJoinMajorGroups(scope: AutoJoinScope = {}): Promise<number> {
  const where: Prisma.Sql[] = [
    Prisma.sql`g."isActive"`,
    Prisma.sql`(cardinality(g.majors) > 0 or cardinality(g.schools) > 0 or cardinality(g.departments) > 0)`,
    Prisma.sql`m."candidateId" is not null`,
    Prisma.sql`m.status in ('CLAIMED', 'ACTIVE')`,
  ]
  if (scope.institutionId) where.push(Prisma.sql`g."institutionId" = ${scope.institutionId}`)
  if (scope.groupId) where.push(Prisma.sql`g.id = ${scope.groupId}`)
  if (scope.memberId) where.push(Prisma.sql`m.id = ${scope.memberId}`)
  const major = Prisma.sql`(m.major is not null and ${norm(Prisma.sql`m.major`)} = any(g.majors))`
  const school = Prisma.sql`(m.school is not null and ${norm(Prisma.sql`m.school`)} = any(g.schools))`
  const department = Prisma.sql`(m.department is not null and ${norm(Prisma.sql`m.department`)} = any(g.departments))`
  return prisma.$executeRaw`
    insert into public."AlumniGroupMember" ("id", "groupId", "memberId", "role", "joinedVia", "isSampleData", "createdAt", "updatedAt")
    select gen_random_uuid()::text, g.id, m.id, 'MEMBER',
      case when ${major} then 'AUTO_MAJOR' when ${department} then 'AUTO_DEPARTMENT' else 'AUTO_SCHOOL' end,
      m."isSampleData", now(), now()
    from public."AlumniGroup" g
    join public."InstitutionMember" m on m."institutionId" = g."institutionId"
    where ${Prisma.join(where, ' and ')}
      and (${major} or ${school} or ${department})
      and not exists (select 1 from public."AlumniGroupLeave" l where l."groupId" = g.id and l."memberId" = m.id)
    on conflict ("groupId", "memberId") do nothing`
}

const COLUMN: Record<AutoJoinField, Prisma.Sql> = {
  major: Prisma.sql`m.major`,
  school: Prisma.sql`m.school`,
  department: Prisma.sql`m.department`,
}

/** The roster's values for one field with how many alumni have each, for the staff form. Bounded; values held by one person are left out. */
export async function rosterValues(institutionId: string, field: AutoJoinField, limit = 200): Promise<{ value: string; n: number }[]> {
  const col = COLUMN[field]
  const rows = await prisma.$queryRaw<{ value: string; n: number }[]>`
    select min(btrim(${col})) as value, count(*)::int as n
    from public."InstitutionMember" m
    where m."institutionId" = ${institutionId} and ${col} is not null and btrim(${col}) <> ''
    group by ${norm(col)}
    having count(*) >= 2
    order by n desc
    limit ${limit}`
  return rows
}

/** Majors, schools and departments on the roster, read together for the group forms. */
export async function rosterAutoJoinOptions(institutionId: string) {
  const [majors, schools, departments] = await Promise.all([rosterValues(institutionId, 'major'), rosterValues(institutionId, 'school'), rosterValues(institutionId, 'department')])
  return { majors, schools, departments }
}
