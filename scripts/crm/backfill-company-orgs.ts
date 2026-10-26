// One-time catch-up: give every directory Company a CRM organization (tagged EMPLOYER, linked to its Company), so each
// employer page has a CRM record that links to it. The nightly job does the same, 500 a night (step 5b of
// syncCompanyGraph); this runs it in bigger batches. Additive only: creates organizations, never edits or deletes one.
//
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/crm/backfill-company-orgs.ts [--dry] [--batch=5000]
import { prisma } from '@/lib/prisma'
import { syncCompanyGraph } from '@/lib/companies/company-graph-sync'

async function main() {
  const dry = process.argv.includes('--dry')
  const batch = Number(process.argv.find((a) => a.startsWith('--batch='))?.split('=')[1] ?? 5000)
  const [{ n }] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "Company" c WHERE NOT EXISTS (SELECT 1 FROM "CrmOrganization" o WHERE o."companyId" = c.id)`)
  console.log(`${n} companies have no CRM organization`)
  if (dry) return
  let total = 0
  const loops = Number(process.argv.find((a) => a.startsWith("--loops="))?.split("=")[1] ?? 20)
  for (let i = 0; i < loops; i++) {
    const r = await syncCompanyGraph({ postingNameLimit: 0, orgCreateLimit: batch })
    total += r.crmOrganizationsCreated
    console.log(`batch ${i + 1}: created ${r.crmOrganizationsCreated}, linked ${r.crmOrganizationsLinked}`)
    if (r.crmOrganizationsCreated === 0) break
  }
  const [{ n: left }] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "Company" c WHERE NOT EXISTS (SELECT 1 FROM "CrmOrganization" o WHERE o."companyId" = c.id)`)
  console.log(`created ${total}; ${left} companies still without one (names that are not real companies, or kept separate)`)
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
