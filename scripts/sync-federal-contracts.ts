// Runs the federal-contract lookup (USAspending.gov, free) by hand; the same code runs
// nightly from /api/cron/federal-contracts.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/sync-federal-contracts.ts [--limit 300] [--dry-run]
import { prisma } from '../src/lib/prisma'
import { syncFederalContracts } from '../src/lib/companies/federal-contracts-sync'

const i = process.argv.indexOf('--limit')
syncFederalContracts({ limit: i >= 0 ? Number(process.argv[i + 1]) : 300, dryRun: process.argv.includes('--dry-run') })
  .then((r) => console.log(JSON.stringify(r)))
  .finally(() => prisma.$disconnect())
