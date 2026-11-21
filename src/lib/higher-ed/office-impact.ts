// Admin › Impact by office (owner, 2026-11-21): what each office did for alumni in the last 12 months, for the whole
// university or one school or department. Counts only, with small cells suppressed (MIN_CELL_SIZE); staff of one school
// or department (InstitutionUnit) see only their own.
//
// Cost: one statement of counts over this institution's alumni (index on InstitutionMember.institutionId and each
// table's memberId), returning one row. Run when the tab opens; a few times a day per college.

import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'

export type ImpactScope = { school: string | null; department: string | null }

export type OfficeImpact = {
  alumni: number
  joined: number
  career: { answered: number; askedHelp: number; onCaseload: number; landed: number; saidHelped: number }
  alumniOffice: { layoffMatched: number; mentors: number }
  development: { paused: number; signals: number; donors: number; donorsHelped: number }
  learning: { needGap: number; opened: number; enrolled: number }
  ventures: { founders: number }
}

const n = (x: unknown) => Number(x ?? 0)

export async function officeImpact(institutionId: string, scope: ImpactScope, now = new Date()): Promise<OfficeImpact> {
  const since = new Date(now.getTime() - 365 * 86_400_000)
  const school = scope.school ? Prisma.sql`and lower(m.school) = lower(${scope.school})` : Prisma.empty
  const dept = scope.department ? Prisma.sql`and lower(m.department) = lower(${scope.department})` : Prisma.empty
  const [r] = await prisma.$queryRaw<Record<string, unknown>[]>`
    with m as (
      select m.id, m.status from public."InstitutionMember" m
      where m."institutionId" = ${institutionId} and m.affiliation in ('ALUM', 'STAFF_ALUM') ${school} ${dept}
    )
    select
      (select count(*) from m) as alumni,
      (select count(*) from m where m.status in ('CLAIMED', 'ACTIVE')) as joined,
      (select count(distinct c."memberId") from public."CheckIn" c join m on m.id = c."memberId" where c.status = 'RESPONDED' and c."respondedAt" >= ${since}) as answered,
      (select count(distinct c."memberId") from public."CheckIn" c join m on m.id = c."memberId" where c.status = 'RESPONDED' and c."respondedAt" >= ${since} and c."responseJson"->>'answer' in ('looking', 'laid_off')) as asked_help,
      (select count(distinct a."memberId") from public."CaseloadAssignment" a join m on m.id = a."memberId" where a."assignedAt" >= ${since}) as on_caseload,
      (select count(distinct o."memberId") from public."OutcomeReport" o join m on m.id = o."memberId" where o."reportedAt" >= ${since}) as landed,
      (select count(distinct o."memberId") from public."OutcomeReport" o join m on m.id = o."memberId" where o."reportedAt" >= ${since} and o."helpedByInstitution") as said_helped,
      (select count(distinct l."memberId") from public."LayoffMatch" l join m on m.id = l."memberId" where l."matchedAt" >= ${since}) as layoff_matched,
      (select count(*) from public."InstitutionMentor" x join m on m.id = x."memberId") as mentors,
      (select count(distinct t."memberId") from public."TransitionFlag" t join m on m.id = t."memberId" where t."clearedAt" is null and t."doNotSolicit") as paused,
      (select count(*) from public."ProspectFlag" p join m on m.id = p."memberId" where p."detectedAt" >= ${since} and p."dismissedAt" is null) as signals,
      (select count(distinct g."memberId") from public."InstitutionGift" g join m on m.id = g."memberId" where g."giftDate" >= ${since}) as donors,
      (select count(distinct g."memberId") from public."InstitutionGift" g join m on m.id = g."memberId"
         where g."giftDate" >= ${since} and exists (select 1 from public."OutcomeReport" o where o."memberId" = g."memberId" and o."helpedByInstitution" and o."reportedAt" < g."giftDate")) as donors_helped,
      (select count(distinct s."memberId") from public."SkillBridgeEvent" s join m on m.id = s."memberId" where s.kind = 'NEED') as need_gap,
      (select count(distinct s."memberId") from public."SkillBridgeEvent" s join m on m.id = s."memberId" where s.kind = 'OPENED') as opened,
      (select count(distinct e."memberId") from public."Enrollment" e join m on m.id = e."memberId" where e."appliedAt" >= ${since}) as enrolled,
      (select count(distinct v."memberId") from public."VentureFlag" v join m on m.id = v."memberId") as founders`
  return {
    alumni: n(r.alumni),
    joined: n(r.joined),
    career: { answered: n(r.answered), askedHelp: n(r.asked_help), onCaseload: n(r.on_caseload), landed: n(r.landed), saidHelped: n(r.said_helped) },
    alumniOffice: { layoffMatched: n(r.layoff_matched), mentors: n(r.mentors) },
    development: { paused: n(r.paused), signals: n(r.signals), donors: n(r.donors), donorsHelped: n(r.donors_helped) },
    learning: { needGap: n(r.need_gap), opened: n(r.opened), enrolled: n(r.enrolled) },
    ventures: { founders: n(r.founders) },
  }
}

/** A count as shown to staff: small groups never shown exactly. */
export const shown = (x: number) => (x === 0 ? '0' : x < MIN_CELL_SIZE ? `fewer than ${MIN_CELL_SIZE}` : x.toLocaleString())

/** The schools and departments on the roster, to choose from (bounded). */
export async function impactScopes(institutionId: string): Promise<{ school: string; department: string | null }[]> {
  const rows = await prisma.institutionMember.groupBy({
    by: ['school', 'department'],
    where: { institutionId, school: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { school: 'desc' } },
    take: 60,
  })
  return rows.map((r) => ({ school: r.school!, department: r.department }))
}
