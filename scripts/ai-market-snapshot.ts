/**
 * Compute and store an AI market snapshot now (what the daily /api/cron/ai-market does), and print
 * the counts and the function x level premium table. For right after a board backfill.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/ai-market-snapshot.ts [--dry-run]
 */
import { computeAiMarket, rebuildAiMarketSnapshot } from '../src/lib/skills/ai-market-live'
import { AI_LEVELS } from '../src/lib/skills/ai-market'
import { prisma } from '../src/lib/prisma'

async function main() {
  const dry = process.argv.includes('--dry-run')
  const data = await computeAiMarket()
  console.log(JSON.stringify({ counts: data.counts, overall: data.overall }, null, 2))
  for (const [code, f] of Object.entries(data.functions).sort((a, b) => b[1].aiSkill - a[1].aiSkill)) {
    const p = f.premium
    console.log(`${code}\tshare ${f.sharePct}%\texposed ${f.exposedPct}%\t${p ? `raw ${p.rawPct}% ($${p.rawUsd}) like ${p.likePct ?? '-'}% n ${p.nAi}/${p.nBase}` : '-'}\ttop ${f.topItems.slice(0, 3).map((i) => i.id).join(',')}`)
    for (const l of AI_LEVELS) {
      const q = f.levels[l]
      if (q) console.log(`\t${l}\traw ${q.rawPct}% ($${q.rawUsd})\tlike ${q.likePct ?? '-'}%\tmed ${q.medAi} vs ${q.medBase}\tn ${q.nAi}/${q.nBase}`)
    }
  }
  if (!dry) console.log('stored', await rebuildAiMarketSnapshot(data))
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
