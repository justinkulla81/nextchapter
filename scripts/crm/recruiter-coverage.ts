/**
 * Tags every recruiter in the CRM with the states, industries and functions they
 * cover, read off their title, location and firm (src/lib/crm/coverage.ts). Only
 * fills people with no tags yet and never overwrites a 'research' tag. Dry run
 * unless --apply.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/recruiter-coverage.ts [--apply]
 */
import { prisma } from '../../src/lib/prisma'
import { deriveCoverage } from '../../src/lib/crm/coverage'

const apply = process.argv.includes('--apply')

async function main() {
  const people = await prisma.crmPerson.findMany({
    where: { deletedAt: null, mergedIntoId: null, roles: { has: 'RECRUITER_PROSPECT' }, OR: [{ coverageSource: null }, { coverageSource: { not: 'research' } }] },
    select: {
      id: true, location: true,
      affiliations: { where: { isCurrent: true }, take: 1, orderBy: { isPrimary: 'desc' }, select: { title: true, org: { select: { id: true, name: true, industry: true, usState: true, orgTypes: true, searchFirms: { take: 1, select: { sampleTitles: true } } } } } },
    },
  })
  const tally = { states: 0, industries: 0, functions: 0, none: 0 }
  let n = 0
  for (const p of people) {
    const a = p.affiliations[0]
    const firm = a?.org.searchFirms[0]
    const c = deriveCoverage({
      title: a?.title ?? null, location: p.location, orgName: a?.org.name ?? null, orgIndustry: a?.org.industry ?? null, orgState: a?.org.usState ?? null,
      isSearchFirm: !!firm || /\b(search|staffing|recruit\w*|executive|headhunt\w*|talent|associates|partners)\b/i.test(a?.org.name ?? ''), firmTitles: firm?.sampleTitles ?? [],
    })
    if (c.states.length) tally.states++
    if (c.industries.length) tally.industries++
    if (c.functions.length) tally.functions++
    if (!c.states.length && !c.industries.length && !c.functions.length) { tally.none++; continue }
    n++
    if (apply) await prisma.crmPerson.update({ where: { id: p.id }, data: { coverageStates: c.states, coverageIndustries: c.industries, coverageFunctions: c.functions, coverageSource: 'derived' } })
  }
  console.log(`${people.length} recruiters read; ${apply ? 'tagged' : 'would tag'} ${n}.`, tally)
}
main().finally(() => prisma.$disconnect())
