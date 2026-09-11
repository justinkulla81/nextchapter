/**
 * Repairs headcounts mangled by the original naive parser.
 *
 *   npm run crm:fix-headcounts -- --dir <csv dir>
 *   npm run crm:fix-headcounts -- --dir <csv dir> --commit
 *
 * The first importer stripped every non-digit, which turned "~1,000 (18%)"
 * into 100018 and "Hundreds (~2%)" into 2 — wrong in the direction that
 * matters, since one inflates a lead a hundredfold and the other buries a real
 * one. Re-reads the source column through parseHeadcount.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'
import { strictOrgKey } from '../../src/lib/crm/normalize'
import { parseHeadcount } from '../../src/lib/crm/funding'
import { toRows } from './parse'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const DIR = (() => {
  const i = process.argv.indexOf('--dir')
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : join(process.cwd(), '.crm-sources')
})()

async function main() {
  console.log(`HEADCOUNT REPAIR — ${COMMIT ? 'COMMIT' : 'DRY RUN'}`)
  const path = join(DIR, 'outplacement.csv')
  if (!existsSync(path)) { console.error(`missing ${path}`); process.exit(1) }

  const orgs = await prisma.crmOrganization.findMany({ select: { id: true, name: true } })
  const byStrict = new Map(orgs.map((o) => [strictOrgKey(o.name, normalizeOrgName), o.id]))
  let fixed = 0

  for (const r of toRows(readFileSync(path, 'utf8'))) {
    const company = r.get('Company')
    const raw = r.get('Headcount Affected')
    if (!company) continue
    const orgId = byStrict.get(strictOrgKey(company, normalizeOrgName))
    if (!orgId) continue
    const profile = await prisma.crmOutplacementProfile.findUnique({ where: { orgId }, select: { headcountAffected: true } })
    if (!profile) continue

    const correct = parseHeadcount(raw)
    if (profile.headcountAffected === correct) continue
    console.log(`  ${company.padEnd(24)} ${String(profile.headcountAffected).padStart(7)} -> ${correct ?? 'null'}   from ${JSON.stringify(raw)}`)
    fixed++
    if (COMMIT) {
      await prisma.crmOutplacementProfile.update({ where: { orgId }, data: { headcountAffected: correct } })
    }
  }
  console.log(`\n${COMMIT ? 'Fixed' : 'Would fix'} ${fixed}.`)
  if (!COMMIT) console.log('Re-run with --commit.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
