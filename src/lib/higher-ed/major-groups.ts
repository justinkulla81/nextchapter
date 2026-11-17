// Auto-join alumni groups by major. A group lists the majors it is for
// (AlumniGroup.majors, normalized); every JOINED member of the college whose
// roster major matches is added as a MEMBER with joinedVia AUTO_MAJOR.
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

/** Adds every matching joined member to every major group in scope. Returns how many memberships were created. */
export async function autoJoinMajorGroups(scope: AutoJoinScope = {}): Promise<number> {
  const where: Prisma.Sql[] = [
    Prisma.sql`g."isActive"`,
    Prisma.sql`cardinality(g.majors) > 0`,
    Prisma.sql`m."candidateId" is not null`,
    Prisma.sql`m.status in ('CLAIMED', 'ACTIVE')`,
    Prisma.sql`m.major is not null`,
  ]
  if (scope.institutionId) where.push(Prisma.sql`g."institutionId" = ${scope.institutionId}`)
  if (scope.groupId) where.push(Prisma.sql`g.id = ${scope.groupId}`)
  if (scope.memberId) where.push(Prisma.sql`m.id = ${scope.memberId}`)
  // The SQL normalization must match normalizeMajor(): lower case, "&" as
  // "and", punctuation dropped, spaces collapsed.
  return prisma.$executeRaw`
    insert into public."AlumniGroupMember" ("id", "groupId", "memberId", "role", "joinedVia", "isSampleData", "createdAt", "updatedAt")
    select gen_random_uuid()::text, g.id, m.id, 'MEMBER', 'AUTO_MAJOR', m."isSampleData", now(), now()
    from public."AlumniGroup" g
    join public."InstitutionMember" m on m."institutionId" = g."institutionId"
    where ${Prisma.join(where, ' and ')}
      and btrim(regexp_replace(regexp_replace(replace(lower(m.major), '&', ' and '), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g')) = any(g.majors)
      and not exists (select 1 from public."AlumniGroupLeave" l where l."groupId" = g.id and l."memberId" = m.id)
    on conflict ("groupId", "memberId") do nothing`
}

/** The roster's majors with how many alumni have each, for the staff form. Bounded; groups under 2 are left out. */
export async function rosterMajors(institutionId: string, limit = 200): Promise<{ major: string; n: number }[]> {
  const rows = await prisma.$queryRaw<{ major: string; n: number }[]>`
    select min(m.major) as major, count(*)::int as n
    from public."InstitutionMember" m
    where m."institutionId" = ${institutionId} and m.major is not null
    group by btrim(regexp_replace(regexp_replace(replace(lower(m.major), '&', ' and '), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g'))
    having count(*) >= 2
    order by n desc
    limit ${limit}`
  return rows.map((r) => ({ major: r.major.trim(), n: r.n }))
}
