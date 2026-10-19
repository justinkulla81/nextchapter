/**
 * After duplicate organizations were merged, the surviving organization kept one
 * Company link and the other Company record was left with no organization, so its
 * layoff notices and postings stopped counting toward the organization. This finds
 * those Companies (no organization, and a name that is the same company as an
 * organization linked to a different Company) and merges them into one.
 *
 * DRY RUN BY DEFAULT.
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm/relink-merged-org-companies.ts [--apply]
 *
 * The Company kept is the one whose name matches the organization's (so "Amazon",
 * not "Amazon Web Services"); the organization is relinked to it first.
 */
import { PrismaClient } from '@prisma/client'
import { looseKey } from '../../src/lib/crm/org-duplicates'
import { decideGroup } from '../../src/lib/crm/org-duplicate-decisions'
import { mergeCompanies } from '../../src/lib/companies/merge-company'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

async function main() {
  const orphans = await prisma.$queryRaw<{ id: string; name: string; notices: number; posts: number }[]>`
    SELECT c.id, c.name,
           (SELECT count(*)::int FROM "WarnNotice" w WHERE w."companyId" = c.id) AS notices,
           (SELECT count(*)::int FROM "ExclusiveJobPosting" j WHERE j."companyId" = c.id) AS posts
      FROM "Company" c
     WHERE NOT EXISTS (SELECT 1 FROM "CrmOrganization" o WHERE o."companyId" = c.id)`
  const orgs = await prisma.crmOrganization.findMany({ where: { companyId: { not: null } }, select: { id: true, name: true, companyId: true } })
  const byKey = new Map<string, typeof orgs>()
  for (const o of orgs) { const k = looseKey(o.name); if (k) byKey.set(k, [...(byKey.get(k) ?? []), o]) }

  const pairs: { orphan: (typeof orphans)[number]; org: (typeof orgs)[number] }[] = []
  for (const c of orphans) {
    const k = looseKey(c.name)
    const hit = k ? byKey.get(k) : undefined
    // Only when the same rules that merge organizations call this pair one company (not "HealthPoint (WA)" / "Healthpoint (TX)", not "Team USA" / "The·team").
    if (hit?.length === 1 && hit[0].companyId !== c.id && decideGroup([c.name, hit[0].name]).action === 'merge') pairs.push({ orphan: c, org: hit[0] })
  }
  console.log(`orphan companies ${orphans.length}; matching an organization linked elsewhere: ${pairs.length}`)
  for (const { orphan, org } of pairs) console.log(`  ${orphan.name} (${orphan.notices} notices, ${orphan.posts} postings) -> org "${org.name}"`)
  if (!APPLY) return console.log('dry run: nothing written')

  let ok = 0
  for (const { orphan, org } of pairs) {
    // Keep the Company whose own name is the organization's name.
    const current = await prisma.company.findUnique({ where: { id: org.companyId! }, select: { id: true, name: true } })
    if (!current) continue
    const keepOrphan = looseKey(orphan.name) === looseKey(org.name) && looseKey(current.name) !== looseKey(org.name)
    const keeperId = keepOrphan ? orphan.id : current.id
    const otherId = keepOrphan ? current.id : orphan.id
    if (keepOrphan) await prisma.crmOrganization.update({ where: { id: org.id }, data: { companyId: orphan.id, companyLinkState: 'ADMIN' } })
    const r = await mergeCompanies(keeperId, otherId, 'relink-merged-org-companies').catch((e: Error) => ({ ok: false as const, reason: e.message.split('\n').slice(-1)[0] }))
    if (r.ok) ok++
    else console.log(`  not merged: ${orphan.name}: ${r.reason}`)
  }
  console.log(`merged ${ok} of ${pairs.length}`)
}
main().finally(() => prisma.$disconnect())
