/**
 * Builds the workforce staff list: tags every CRM person currently at a workforce board, American Job Center or state
 * workforce agency with a role and level from their title (src/lib/crm/workforce-staff.ts). Dry run unless --apply.
 * Reads one row per current affiliation at workforce-named organizations (about 1,500 people), never the whole table.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/workforce-staff.ts [--apply]
 */
import { prisma } from '../../src/lib/prisma'
import { classifyWorkforceStaff, isWorkforceSystemOrg, WORKFORCE_ORG_NAME } from '../../src/lib/crm/workforce-staff'

const apply = process.argv.includes('--apply')

async function main() {
  const rows = await prisma.crmAffiliation.findMany({
    where: { isCurrent: true, org: { OR: [{ name: { contains: 'workforce', mode: 'insensitive' } }, { name: { contains: 'job cent', mode: 'insensitive' } }, { name: { contains: 'one-stop', mode: 'insensitive' } }, { name: { contains: 'one stop', mode: 'insensitive' } }, { name: { contains: 'careerone', mode: 'insensitive' } }, { name: { contains: 'rapid response', mode: 'insensitive' } }, { name: { contains: 'labor', mode: 'insensitive' } }] }, person: { deletedAt: null, mergedIntoId: null } },
    select: { title: true, personId: true, org: { select: { name: true } } },
    take: 5000,
  })
  const tally: Record<string, number> = {}
  const writes = new Map<string, { role: string; level: string }>()
  for (const r of rows) {
    if (!WORKFORCE_ORG_NAME.test(r.org.name) || !isWorkforceSystemOrg(r.org.name)) continue
    const tag = classifyWorkforceStaff(r.title)
    writes.set(r.personId, { role: tag.role, level: tag.level })
    const k = `${tag.role}/${tag.level}`
    tally[k] = (tally[k] ?? 0) + 1
  }
  console.log(writes.size, 'people', tally)
  if (!apply) return
  for (const [id, v] of writes) await prisma.crmPerson.update({ where: { id }, data: { workforceStaffRole: v.role, workforceStaffLevel: v.level } })
  console.log('written')
}
main().finally(() => prisma.$disconnect())
