/**
 * Reads how each recruiter works (retained, contingent, candidate representation, in-house) from the text we hold:
 * title, firm name, notes. Adds to what is there and never removes a model set by hand or by research. Dry run unless --apply.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/recruiter-models.ts [--apply]
 */
import { prisma } from '../../src/lib/prisma'
import { readRecruiterModels } from '../../src/lib/crm/recruiter-model'

const apply = process.argv.includes('--apply')
async function main() {
  const people = await prisma.crmPerson.findMany({
    where: { deletedAt: null, mergedIntoId: null, roles: { has: 'RECRUITER_PROSPECT' } },
    select: { id: true, notes: true, recruiterModels: true, modelEvidence: true, affiliations: { where: { isCurrent: true }, take: 1, select: { title: true, org: { select: { name: true, notes: true, focus: true } } } } },
  })
  const tally: Record<string, number> = {}
  let changed = 0
  for (const p of people) {
    const a = p.affiliations[0]
    const r = readRecruiterModels([a?.title, a?.org.name, a?.org.focus, a?.org.notes, p.notes].filter(Boolean).join(' · '))
    const merged = [...new Set([...p.recruiterModels, ...r.models])]
    for (const m of r.models) tally[m] = (tally[m] ?? 0) + 1
    if (merged.length === p.recruiterModels.length) continue
    changed++
    if (apply) await prisma.crmPerson.update({ where: { id: p.id }, data: { recruiterModels: merged, ...(r.evidence && !p.modelEvidence ? { modelEvidence: r.evidence } : {}) } })
  }
  console.log(`${people.length} recruiters read; ${apply ? 'updated' : 'would update'} ${changed}.`, tally)
}
main().finally(() => prisma.$disconnect())
