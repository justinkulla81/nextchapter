/**
 * Deletes CRM activity that predates CRM_ACTIVITY_CUTOFF.
 *
 * The cutoff already hides these rows from every view and every derived
 * number (see src/lib/crm/cutoff.ts); this removes them for real. Direct
 * instruction — a decade of pre-company mail is not CRM history.
 *
 * Irreversible, so: it writes a JSON copy of every row it is about to
 * delete before deleting anything, it refuses to touch hand-entered
 * activity (isAutoLogged: false is somebody's deliberate record, not sweep
 * output), and it stops if a row carries open/click tracking, which would
 * cascade away with it.
 *
 *   npm run crm:purge-precutoff                    — report and write the backup
 *   npm run crm:purge-precutoff -- --write         — delete them
 */
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { CRM_ACTIVITY_CUTOFF } from '../../src/lib/crm/cutoff'

const prisma = new PrismaClient()
const WRITE = process.argv.includes('--write')
const BACKUP = process.argv.find((a) => a.startsWith('--backup='))?.split('=')[1]
  ?? `precutoff-activities-${new Date().toISOString().slice(0, 10)}.json`

async function main() {
  console.log(`cutoff ${CRM_ACTIVITY_CUTOFF.toISOString()} · ${WRITE ? 'DELETING' : 'dry run'}`)

  const rows = await prisma.crmActivity.findMany({
    where: { occurredAt: { lt: CRM_ACTIVITY_CUTOFF } },
    include: {
      person: { select: { id: true, fullName: true } },
      outreachTracking: { select: { id: true } },
    },
    orderBy: { occurredAt: 'asc' },
  })

  const manual = rows.filter((r) => !r.isAutoLogged)
  const tracked = rows.filter((r) => r.outreachTracking)
  const doomed = rows.filter((r) => r.isAutoLogged && !r.outreachTracking)

  console.log(`${rows.length} rows before the cutoff`)
  console.log(`  ${doomed.length} auto-logged, untracked — will be deleted`)
  console.log(`  ${manual.length} hand-entered — KEPT (somebody typed these)`)
  console.log(`  ${tracked.length} carrying open/click tracking — KEPT (it would cascade)`)

  const byYear = new Map<number, number>()
  for (const r of doomed) byYear.set(r.occurredAt.getFullYear(), (byYear.get(r.occurredAt.getFullYear()) ?? 0) + 1)
  console.log('  by year:', [...byYear.entries()].sort().map(([y, n]) => `${y}: ${n}`).join(' · '))

  const people = new Map<string, number>()
  for (const r of doomed) {
    const name = r.person?.fullName ?? '(no person)'
    people.set(name, (people.get(name) ?? 0) + 1)
  }
  console.log('  people:', [...people.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} (${c})`).join(', '))

  writeFileSync(BACKUP, JSON.stringify(doomed, null, 2))
  console.log(`\nbackup written: ${BACKUP}`)

  if (!WRITE) {
    console.log('dry run — nothing deleted. Re-run with --write.')
    return
  }

  const { count } = await prisma.crmActivity.deleteMany({
    where: { id: { in: doomed.map((r) => r.id) } },
  })
  console.log(`deleted ${count} rows`)

  const left = await prisma.crmActivity.count({ where: { occurredAt: { lt: CRM_ACTIVITY_CUTOFF } } })
  console.log(`${left} pre-cutoff rows remain (hand-entered or tracked)`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
