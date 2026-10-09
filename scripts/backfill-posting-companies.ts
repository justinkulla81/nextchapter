// One-time catch-up: creates a Company row for every employer that has a live
// job posting. The nightly company-signals cron does exactly this
// (getOrCreateCompany per open-posting employer) — this just runs it now,
// after a bulk import, instead of waiting for the next cron. Idempotent, no
// AI cost, writes nothing but bare Company rows (name + normalized key).
//
// Run: node --env-file=.env.local --conditions=react-server --import tsx scripts/backfill-posting-companies.ts [--dry]

import { prisma } from '../src/lib/prisma'
import { getOrCreateCompany } from '../src/lib/companies/company-lookup'
import { normalizeOrgName } from '../src/lib/text/org-name-match'

async function main() {
  const dry = process.argv.includes('--dry')
  const rows = await prisma.exclusiveJobPosting.findMany({
    where: { archivedAt: null },
    select: { companyName: true },
  })
  // First-seen raw casing per normalized key, same as the cron.
  const byKey = new Map<string, string>()
  for (const r of rows) {
    const key = normalizeOrgName(r.companyName)
    if (key && !byKey.has(key)) byKey.set(key, r.companyName)
  }
  const existing = new Set((await prisma.company.findMany({ select: { canonicalNameNormalized: true } })).map((c) => c.canonicalNameNormalized))
  const missing = [...byKey.entries()].filter(([k]) => !existing.has(k))
  console.log(`open postings=${rows.length} distinct employers=${byKey.size} already in directory=${byKey.size - missing.length} to create=${missing.length}`)
  if (dry) return

  let created = 0
  for (const [, rawName] of missing) {
    await getOrCreateCompany(rawName)
    if (++created % 500 === 0) console.log(`${created}/${missing.length}`)
  }
  console.log(`created ${created}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
