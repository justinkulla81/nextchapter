// One-off: folds the two duplicate CRM records found during the September
// report backfill into the fuller record of each pair. Same person in each
// pair (same LinkedIn/org, the other carrying the email address).
//
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/merge-report-duplicates-2026-10.ts
import { prisma } from '../src/lib/prisma'
import { mergePersonRecords } from '../src/lib/crm/merge-person'

const PAIRS = [
  // Grant Trahant: bare record (no email, no org) → the full record.
  { source: 'cmtx1odsq0567q2bmq3xcibd0', target: 'cmu4wibbb003jl6044fxfh9bl' },
  // Jason Wendle: "jason.wendle" (email + Sept report) → the named record with LinkedIn and org.
  { source: 'cmuyezg3d0003js04r095xh01', target: 'cmuydqgyh0001ld04tlzkrns2' },
]

async function main() {
  for (const p of PAIRS) {
    const src = await prisma.crmPerson.findUnique({ where: { id: p.source }, select: { deletedAt: true } })
    if (!src || src.deletedAt) { console.log(`skip ${p.source}: already merged or removed`); continue }
    const r = await mergePersonRecords(p.source, p.target)
    const t = await prisma.crmPerson.findUniqueOrThrow({
      where: { id: p.target },
      select: { fullName: true, email: true, linkedinUrl: true, _count: { select: { activities: true, reportSends: true } } },
    })
    console.log(`merged "${r.sourceName}" into "${r.targetName}" → ${t.email ?? 'no email'}, ${t._count.activities} activities, ${t._count.reportSends} report receipts`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
