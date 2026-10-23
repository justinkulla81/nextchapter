/**
 * One-off: "Blue Signal" and "Blue Signal Search" were imported as two organizations, so every Blue Signal
 * recruiter exists twice. Merges each duplicate person into the one at "Blue Signal Search" (keeping the union
 * of their coverage tags), then merges the organizations.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/merge-blue-signal.ts [--apply]
 */
import { prisma } from '../../src/lib/prisma'
import { mergePersonRecords } from '../../src/lib/crm/merge-person'
import { mergeOrganizations } from '../../src/lib/crm/merge-organization'

const apply = process.argv.includes('--apply')
const KEEP = 'cm2c07363bfc26460a8dffd2751d9e070c' // Blue Signal Search
const DROP = 'cmv25kpx1001nq2lfrr3sflpg' // Blue Signal

async function main() {
  const sel = { id: true, fullName: true, coverageStates: true, coverageIndustries: true, coverageFunctions: true }
  const keep = await prisma.crmPerson.findMany({ where: { deletedAt: null, mergedIntoId: null, affiliations: { some: { orgId: KEEP } } }, select: sel })
  const drop = await prisma.crmPerson.findMany({ where: { deletedAt: null, mergedIntoId: null, affiliations: { some: { orgId: DROP } } }, select: sel })
  const keepBy = new Map(keep.map((p) => [p.fullName.toLowerCase(), p]))
  const pairs = drop.flatMap((d) => { const k = keepBy.get(d.fullName.toLowerCase()); return k && k.id !== d.id ? [{ d, k }] : [] })
  console.log(`${keep.length} at Blue Signal Search, ${drop.length} at Blue Signal, ${pairs.length} duplicate pairs`)
  if (!apply) return
  for (const { d, k } of pairs) {
    await prisma.crmPerson.update({ where: { id: k.id }, data: {
      coverageStates: [...new Set([...k.coverageStates, ...d.coverageStates])], coverageIndustries: [...new Set([...k.coverageIndustries, ...d.coverageIndustries])],
      coverageFunctions: [...new Set([...k.coverageFunctions, ...d.coverageFunctions])],
    } })
    await mergePersonRecords(d.id, k.id)
  }
  const r = await mergeOrganizations(KEEP, DROP, null)
  console.log('org merge', r)
}
main().finally(() => prisma.$disconnect())
