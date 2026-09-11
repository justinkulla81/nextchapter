/**
 * Derives goals from the contact types and org types already on record.
 *
 *   npm run crm:goals              # dry run
 *   npm run crm:goals -- --commit
 *
 * Only fills rows whose goals are EMPTY: a goal set by hand is a deliberate
 * override and must survive the next re-derivation, otherwise the manual edit
 * silently reverts the next time this runs.
 */
import { PrismaClient } from '@prisma/client'
import { goalsForRoles, goalsForOrgTypes, GOAL_LABELS, PIPELINE_GOAL } from '../../src/lib/crm/goals'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')

async function main() {
  console.log(`GOAL BACKFILL — ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)

  const people = await prisma.crmPerson.findMany({
    where: { goals: { isEmpty: true } },
    select: { id: true, roles: true },
  })
  const orgs = await prisma.crmOrganization.findMany({
    where: { goals: { isEmpty: true } },
    select: { id: true, orgTypes: true },
  })

  const personPlan = people
    .map((p) => ({ id: p.id, goals: goalsForRoles(p.roles) }))
    .filter((p) => p.goals.length > 0)
  const orgPlan = orgs
    .map((o) => ({ id: o.id, goals: goalsForOrgTypes(o.orgTypes) }))
    .filter((o) => o.goals.length > 0)

  const tally = new Map<string, number>()
  for (const p of personPlan) for (const g of p.goals) tally.set(g, (tally.get(g) ?? 0) + 1)

  console.log(`\npeople without goals : ${people.length}`)
  console.log(`  would set          : ${personPlan.length}`)
  console.log(`  left blank         : ${people.length - personPlan.length} (connector/press/other, or no type at all)`)
  console.log(`organizations        : ${orgPlan.length} of ${orgs.length}`)
  console.log('\nPEOPLE BY GOAL')
  for (const [g, n] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${GOAL_LABELS[g as keyof typeof GOAL_LABELS].padEnd(24)}${String(n).padStart(6)}`)
  }

  if (!COMMIT) { console.log('\nDry run — nothing written. Re-run with --commit.'); return }

  // Grouped by identical goal set so this is a handful of updateMany calls
  // rather than thousands of single-row updates.
  const groupBySet = (rows: { id: string; goals: string[] }[]) => {
    const m = new Map<string, string[]>()
    for (const r of rows) {
      const k = [...r.goals].sort().join(',')
      m.set(k, [...(m.get(k) ?? []), r.id])
    }
    return m
  }

  for (const [key, ids] of groupBySet(personPlan)) {
    await prisma.crmPerson.updateMany({ where: { id: { in: ids } }, data: { goals: key.split(',') as never } })
  }
  for (const [key, ids] of groupBySet(orgPlan)) {
    await prisma.crmOrganization.updateMany({ where: { id: { in: ids } }, data: { goals: key.split(',') as never } })
  }

  let pipes = 0
  for (const [k, goal] of Object.entries(PIPELINE_GOAL)) {
    const r = await prisma.crmPipeline.updateMany({ where: { key: k }, data: { goal } })
    pipes += r.count
  }

  console.log(`\nWritten. ${personPlan.length} people, ${orgPlan.length} organizations, ${pipes} pipelines.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
