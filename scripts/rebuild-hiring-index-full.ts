// One-time (or manual) FULL rebuild of the company hiring index: benchmarks, every
// opening's market pay + live posting copy, every company's profile. Paged, paced,
// and stops if WAL or database size climbs past the limits below.
//
//   set -a; . ./.env.local; set +a
//   npx tsx --conditions=react-server scripts/rebuild-hiring-index-full.ts [--skip-benchmarks] [--skip-market] [--skip-profiles]
import { prisma } from '@/lib/prisma'
import {
  companyIdsToProfile,
  openingIdsToPrice,
  priceOpeningsPaged,
  rebuildHiringProfilesPaged,
  rebuildPayBenchmarks,
} from '@/lib/companies/hiring-index'

const MAX_WAL_BYTES = 1.8 * 1024 ** 3
const MAX_DB_BYTES = 4 * 1024 ** 3
const args = new Set(process.argv.slice(2))
let peakWal = 0
let peakDb = 0

async function diskOk(label: string): Promise<boolean> {
  const [r] = await prisma.$queryRawUnsafe<{ wal: bigint | null; db: bigint }[]>(
    `SELECT (SELECT sum(size) FROM pg_ls_waldir())::bigint AS wal, pg_database_size(current_database())::bigint AS db`
  )
  const wal = Number(r.wal ?? 0)
  const db = Number(r.db)
  peakWal = Math.max(peakWal, wal)
  peakDb = Math.max(peakDb, db)
  console.log(`${new Date().toISOString()} ${label} wal=${(wal / 1024 ** 2).toFixed(0)}MB db=${(db / 1024 ** 2).toFixed(0)}MB`)
  if (wal > MAX_WAL_BYTES || db > MAX_DB_BYTES) {
    console.log('STOP: disk limit reached')
    return false
  }
  return true
}

async function main() {
  if (!(await diskOk('start'))) return
  if (!args.has('--skip-benchmarks')) console.log('benchmarks', await rebuildPayBenchmarks())
  if (!args.has('--skip-market')) {
    const ids = await openingIdsToPrice({ all: true })
    const r = await priceOpeningsPaged(ids, {
      pauseMs: 3000,
      onPage: async (done, total) => (done % 20_000 === 0 || done === total ? diskOk(`market ${done}/${total}`) : true),
    })
    console.log('market', r)
  }
  if (!args.has('--skip-profiles')) {
    const ids = await companyIdsToProfile({ all: true })
    const r = await rebuildHiringProfilesPaged(ids, {
      pauseMs: 2000,
      onPage: async (done, total) => (done % 4000 === 0 || done === total ? diskOk(`profiles ${done}/${total}`) : true),
    })
    console.log('profiles', r)
  }
  await diskOk('end')
  console.log(`peak wal=${(peakWal / 1024 ** 2).toFixed(0)}MB db=${(peakDb / 1024 ** 2).toFixed(0)}MB`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
