/**
 * Classifies every person with the recruiter role as search/agency recruiter, in-house talent acquisition, HR,
 * support or unclear (src/lib/crm/recruiter-kind.ts), and writes it to recruiterKind. Dry run unless --apply.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/recruiter-kind.ts [--apply]
 */
import { prisma } from '../../src/lib/prisma'
import { classifyRecruiter, type RecruiterKind } from '../../src/lib/crm/recruiter-kind'

const apply = process.argv.includes('--apply')
const FIRM_NAME = /\b(search|staffing|recruit\w*|headhunt\w*)\b/i

async function main() {
  const people = await prisma.crmPerson.findMany({
    where: { deletedAt: null, mergedIntoId: null, roles: { has: 'RECRUITER_PROSPECT' } },
    select: { id: true, coverageSource: true, recruiterKind: true, affiliations: { where: { isCurrent: true }, take: 1, select: { title: true, org: { select: { name: true, industry: true, searchFirms: { take: 1, select: { id: true } } } } } } },
  })
  const tally: Record<string, number> = {}
  const byKind = new Map<RecruiterKind, string[]>()
  for (const p of people) {
    const a = p.affiliations[0]
    const atSearchFirm = p.coverageSource === 'research' || !!a?.org.searchFirms.length || FIRM_NAME.test(a?.org.name ?? '')
    const kind = classifyRecruiter({ title: a?.title ?? null, atSearchFirm, labelledRecruitingFirm: a?.org.industry === 'Staffing / Recruiting' })
    tally[kind] = (tally[kind] ?? 0) + 1
    if (p.recruiterKind !== kind) byKind.set(kind, [...(byKind.get(kind) ?? []), p.id])
  }
  console.log(people.length, 'people', tally)
  if (!apply) return
  for (const [kind, ids] of byKind) {
    for (let i = 0; i < ids.length; i += 500) await prisma.crmPerson.updateMany({ where: { id: { in: ids.slice(i, i + 500) } }, data: { recruiterKind: kind } })
  }
  console.log('written')
}
main().finally(() => prisma.$disconnect())
