// One-time (and re-runnable) import of competitor wins into the CRM, in batches. Same code the competitor-watch cron runs.
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm/competitor-wins-import.ts [--batch 200] [--max-batches 20]
import { prisma } from '../../src/lib/prisma'
import { syncCrmWins } from '../../src/lib/vision/competitor-sync'

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined }
const batch = Number(arg('--batch') ?? 200)
const maxBatches = Number(arg('--max-batches') ?? 20)

async function main() {
  const cards = await prisma.productCompetitor.findMany({ where: { status: 'ACTIVE' } })
  let total = 0
  for (let i = 1; i <= maxBatches; i++) {
    const n = await syncCrmWins(cards, new Date(), batch)
    total += n
    console.log(`batch ${i}: ${n} new notes`)
    if (n === 0) break
  }
  console.log(`done: ${total} new notes`)
}
main().finally(() => prisma.$disconnect())
