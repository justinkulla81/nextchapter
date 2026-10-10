// One-off catch-up for the company graph: links every posting, employer, recruiter
// firm, outplacement org and CRM organisation to its directory company (exact
// name matches only), and fills websites from sources people typed. The nightly
// company-signals job does the same incrementally; this runs it with a large
// limit after the schema change, then reports what it did.
//
// Run: node --env-file=.env.local --conditions=react-server --import tsx scripts/sync-company-graph.ts [--names=N]

import { syncCompanyGraph } from '../src/lib/companies/company-graph-sync'
import { prisma } from '../src/lib/prisma'

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--names='))
  const postingNameLimit = arg ? Number(arg.split('=')[1]) : 20000
  const started = Date.now()
  const result = await syncCompanyGraph({ postingNameLimit })
  console.log(JSON.stringify(result, null, 2))
  console.log(`done in ${Math.round((Date.now() - started) / 1000)}s`)
  await prisma.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
