// One-time backfill: ensures every real staffing/search firm on file
// (RecruiterFirm.name, and any Recruiter.firmName not already covered by
// one) has a matching row in the candidate-facing Company directory —
// "recruiters should also be companies." Safe to re-run: getOrCreateCompany
// is idempotent (upserts on canonicalNameNormalized), so this never creates
// duplicates. Going forward, the Company page itself resolves recruiting
// firms by fuzzy name match (src/lib/companies/recruiting-firm.ts) without
// needing a live row already on file — this backfill just makes sure
// existing firms show up in the searchable Companies directory too, not
// only when a candidate happens to land on their page via some other link.
//
// Run: npx tsx scripts/backfill-recruiting-firm-companies.ts

import { PrismaClient } from '@prisma/client'
import { normalizeOrgName, fixAllCapsCompanyName } from '../src/lib/text/org-name-match'

const prisma = new PrismaClient()

async function getOrCreateCompany(rawName: string) {
  const name = fixAllCapsCompanyName(rawName.trim())
  const canonicalNameNormalized = normalizeOrgName(name)
  if (!canonicalNameNormalized) return null
  return prisma.company.upsert({
    where: { canonicalNameNormalized },
    update: {},
    create: { name, canonicalNameNormalized },
  })
}

async function main() {
  const [firms, recruiters] = await Promise.all([
    prisma.recruiterFirm.findMany({ select: { name: true } }),
    prisma.recruiter.findMany({ where: { firmName: { not: null } }, select: { firmName: true } }),
  ])

  const names = new Set<string>()
  for (const f of firms) names.add(f.name)
  for (const r of recruiters) if (r.firmName) names.add(r.firmName)

  let created = 0
  let existing = 0
  for (const name of names) {
    const before = await prisma.company.findUnique({ where: { canonicalNameNormalized: normalizeOrgName(name) } })
    await getOrCreateCompany(name)
    if (before) existing++
    else created++
  }

  console.log(`Recruiting firm names on file: ${names.size}. Created ${created} new Company rows, ${existing} already existed.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
