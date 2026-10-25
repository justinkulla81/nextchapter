// Proves getEmployerAccess (src/lib/employer/access.ts) is a superset of today's employer access, on a real database.
// Build plan step 5. READ ONLY: the client is wrapped so any write, raw SQL or transaction throws (scripts/employer/read-only-db.ts).
//
//   npm run employer:access-diff -- --dry-run     show what it would read; connects to nothing
//   npm run employer:access-diff                  run against DATABASE_URL (read only)
//   npm run employer:access-diff -- --user <id>   check one user
//   npm run employer:access-diff -- --limit 500   check the first 500 users
//   npm run employer:access-diff -- --json        machine-readable report
//
// Exit code 0 when no user loses anything, 1 when any difference is found (fix it, run again), 2 on an error.

import { PrismaClient } from '@prisma/client'
import { getEmployerAccess, type EmployerAccessDb } from '@/lib/employer/access'
import { readOnlyDb } from './read-only-db'
import { runDiff } from './access-diff-lib'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const flag = (name: string) => process.argv.includes(`--${name}`)

async function main() {
  const json = flag('json')
  const limit = arg('limit') ? Number(arg('limit')) : undefined
  const only = arg('user')

  if (flag('dry-run')) {
    console.log('Dry run. Nothing is read and nothing is written. A real run (still read only) would:')
    console.log('  1. list user ids from EmployerProfile, accepted EmployerSeat and OutplacementOrgUser')
    console.log("  2. for each, derive today's access with its own queries, and call getEmployerAccess")
    console.log('  3. report every legacy grant (section, role, record) that getEmployerAccess does not return')
    console.log(`  options: user=${only ?? 'all'} limit=${limit ?? 'none'} json=${json}`)
    return
  }

  const base = new PrismaClient()
  const db = readOnlyDb(base) as unknown as EmployerAccessDb & PrismaClient
  try {
    let userIds: string[]
    if (only) userIds = [only]
    else {
      const [profiles, seats, orgUsers] = await Promise.all([
        db.employerProfile.findMany({ select: { userId: true } }),
        db.employerSeat.findMany({ where: { userId: { not: null }, acceptedAt: { not: null } }, select: { userId: true } }),
        db.outplacementOrgUser.findMany({ where: { userId: { not: null } }, select: { userId: true } }),
      ])
      userIds = [...new Set([...profiles, ...seats, ...orgUsers].map((r) => r.userId).filter((u): u is string => !!u))].sort()
      if (limit) userIds = userIds.slice(0, limit)
    }
    const report = await runDiff(db, userIds, (userId) => getEmployerAccess({ userId }, db), (d, t) => !json && console.error(`checked ${d}/${t}`))
    if (json) console.log(JSON.stringify(report, null, 2))
    else {
      console.log(`Users checked: ${report.usersChecked} (${report.usersWithAccess} hold a section today)`)
      console.log(`Grants the new function adds on top of today's: ${report.addedGrants}`)
      console.log(`Users who would LOSE something: ${report.differences.length}`)
      for (const d of report.differences) console.log(`  ${d.userId}: ${d.missing.map((m) => `${m.section}/${m.role}@${m.recordId}`).join(', ')}`)
      if (!report.differences.length) console.log("OK: getEmployerAccess is a superset of today's access for every user checked.")
    }
    process.exitCode = report.differences.length ? 1 : 0
  } finally {
    await base.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
