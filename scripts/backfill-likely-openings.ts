/**
 * First-run backfill for LikelyOpening: pulls the last N days (default 60)
 * of 8-K Item 5.02 and Form D filings from SEC EDGAR, same rules as the
 * daily cron (/api/cron/likely-openings). Safe to re-run — stored filings are
 * skipped. No time limit; ~8 requests/second to stay under SEC's 10/s cap.
 *
 * Rule-flagged 8-Ks get the cached Claude Haiku pass (llm-read.ts).
 *
 * Usage: node --env-file=.env.local --conditions=react-server --import tsx scripts/backfill-likely-openings.ts [days]
 */
import { prisma } from '../src/lib/prisma'
import { ingestLikelyOpenings } from '../src/lib/likely-openings/ingest'

async function main() {
  const days = Number(process.argv[2]) || 60
  const started = Date.now()
  const stats = await ingestLikelyOpenings({ days, log: (m) => console.log(m) })
  console.log(JSON.stringify(stats, null, 2))
  console.log(`done in ${Math.round((Date.now() - started) / 1000)}s`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
