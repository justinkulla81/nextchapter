// Measures search breadth on real members: jobs on the board at Narrow (adaptive tier) and
// Wide, the line Narrow shows, the market-size view, and timings. Read-only.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/careers/measure-search-breadth.ts <candidateId>...
import { prisma } from '../../src/lib/prisma'
import { loadBoardShortlist } from '../../src/lib/jobs/board-shortlist'
import { memberStageWindow } from '../../src/lib/jobs/career-stage'
import { boardBreadthFor, narrowExplanation } from '../../src/lib/jobs/search-breadth'
import { loadMarketSize } from '../../src/lib/market/market-size-server'
import { growthPhrase } from '../../src/lib/market/market-size'


async function main() {
  for (const id of process.argv.slice(2)) {
    const profile = await prisma.candidateProfile.findUniqueOrThrow({ where: { id } })
    const base = { candidate: profile, isCandidatePlus: true, stageWindow: memberStageWindow(profile), includeMidLevel: true, includeEarlyCareer: true }
    await loadBoardShortlist({ ...base, breadth: 'off' })
    let t = Date.now()
    const off = await loadBoardShortlist({ ...base, breadth: 'off' })
    const offMs = Date.now() - t
    t = Date.now()
    const narrow = await loadBoardShortlist({ ...base, breadth: 'narrow' })
    const narrowMs = Date.now() - t
    t = Date.now()
    const narrow2 = await loadBoardShortlist({ ...base, breadth: 'narrow' })
    const narrow2Ms = Date.now() - t
    t = Date.now()
    const wide = await loadBoardShortlist({ ...base, breadth: 'wide' })
    const wideMs = Date.now() - t
    t = Date.now()
    const market = await loadMarketSize(profile)
    const marketMs = Date.now() - t
    const c = narrow.breadth.classifier
    const total = (b: typeof off) => b.openTotal + b.lockedTotal
    console.log(`\n=== ${id} | ${profile.highestLevelReached ?? '-'} ${profile.yearsExperience ?? '-'}y | ${profile.primaryFunction} | "${profile.resumeLatestJobTitle ?? ''}" | ${profile.industryContext ?? ''} | ${profile.currentState ?? '-'} ${profile.remotePreference ?? ''}`)
    console.log(`default ${boardBreadthFor(profile)} | sub ${c?.member.subFunction} | window ${total(off)} | narrow ${total(narrow)} (filter ${narrow.breadth.narrowFilter}) | wide ${total(wide)}`)
    if (c) console.log(`line: ${narrowExplanation(narrow.breadth.narrowFilter, narrow.breadth.narrowTotal, c.member)}`)
    console.log(`ms: board no breadth ${offMs} | narrow ${narrowMs} | narrow again ${narrow2Ms} | wide ${wideMs} | market size ${marketMs} | rows ${narrow2.open.length}`)
    if (market) {
      console.log(`market: ${market.target.label} | open ${market.counts.openNow} new14 ${market.counts.newRecent} new28 ${market.counts.newPrior} closed14 ${market.counts.closedRecent} | ${growthPhrase(market.growth)} | prompt ${market.prompt}`)
      for (const a of market.areas) console.log(`  area: ${a.label} · ${a.openNow} open · growth ${a.growth === null ? '-' : Math.round(a.growth * 100) + '%'}`)
      for (const s of market.slices) console.log(`  slice: ${s.label} · ${s.openNow}`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
